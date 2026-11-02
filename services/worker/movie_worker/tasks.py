"""ジョブ実行のエントリポイント。RQ から `run_job(job_id)` が呼ばれる(inline バックエンドでは API から直接)。

責務:
- DB からジョブを読み、status/progress を更新し、Redis に進捗を publish する
- 種別ごとのパイプライン関数へディスパッチ
- OOM なら quality を一段下げて再試行(最大 2 回)、失敗種別を分類して記録
"""
from __future__ import annotations

import logging
import traceback
from typing import Any

from movie_api.db import JobRow, session_scope
from movie_api.events import publish_job
from movie_schema import Job, JobFailureKind, JobKind, JobProgress, JobStatus
from movie_schema.common import utcnow

from .pipelines import generate, render
from .vram import OutOfMemory, next_quality, vram_used_mb

log = logging.getLogger(__name__)
MAX_ATTEMPTS = 3


def _save(job: Job) -> None:
    with session_scope() as s:
        row = s.get(JobRow, job.id)
        if row is None:
            raise ValueError(f"job not found: {job.id}")
        row.update_from_model(job)
        s.commit()
    publish_job(job)


def _load(job_id: str) -> Job:
    with session_scope() as s:
        row = s.get(JobRow, job_id)
        if row is None:
            raise ValueError(f"job not found: {job_id}")
        return row.to_model()


def _dispatch(job: Job, progress) -> dict[str, Any]:
    k = job.kind
    if k == JobKind.generate_concept_image:
        return generate.generate_concept_image(job.params, progress)
    if k == JobKind.generate_shape:
        return generate.generate_shape(job.params, progress)
    if k == JobKind.generate_texture:
        return generate.generate_texture(job.params, progress)
    if k == JobKind.rig:
        return generate.rig(job.params, progress)
    if k == JobKind.render_video:
        return render.render_video(job.params, progress, job.id)
    raise NotImplementedError(f"job kind not implemented yet: {k.value}")


def run_job(job_id: str) -> None:
    job = _load(job_id)
    if job.status == JobStatus.canceled:
        return
    job.status = JobStatus.running
    job.started_at = utcnow()
    _save(job)

    def progress(stage: str, percent: float, message: str = "") -> None:
        job.progress = JobProgress(stage=stage, percent=max(0.0, min(100.0, percent)), message=message,
                                   vram_used_mb=vram_used_mb())
        _save(job)

    while True:
        try:
            job.result = _dispatch(job, progress)
            job.status = JobStatus.succeeded
            job.progress.percent = 100
            break
        except OutOfMemory as exc:
            q = next_quality(job.params.get("quality", "high"))
            if q is None or job.attempt >= MAX_ATTEMPTS:
                job.status, job.failure_kind, job.error = JobStatus.failed, JobFailureKind.oom, str(exc)
                break
            log.warning("OOM on job %s, retrying with quality=%s", job.id, q)
            job.params["quality"] = q
            job.attempt += 1
            progress("retry", 0, f"VRAM 不足のため quality={q} で再試行")
        except ValueError as exc:
            job.status, job.failure_kind, job.error = JobStatus.failed, JobFailureKind.invalid_input, str(exc)
            break
        except NotImplementedError as exc:
            job.status, job.failure_kind, job.error = JobStatus.failed, JobFailureKind.model_error, str(exc)
            break
        except Exception as exc:  # noqa: BLE001
            log.error("job %s failed: %s", job.id, traceback.format_exc())
            job.status, job.failure_kind, job.error = JobStatus.failed, JobFailureKind.unknown, str(exc)
            break

    job.finished_at = utcnow()
    _save(job)
