from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import Field

from .common import StrictModel, utcnow

__all__ = ["JobKind", "JobStatus", "JobFailureKind", "JobProgress", "Job", "JobCreate"]


class JobKind(str, Enum):
    generate_concept_image = "generate_concept_image"
    generate_shape = "generate_shape"
    generate_texture = "generate_texture"
    postprocess = "postprocess"
    rig = "rig"
    generate_motion = "generate_motion"
    render_video = "render_video"
    import_motion = "import_motion"


# GPU を使う種別。ワーカーはこれらを直列に実行する
GPU_JOB_KINDS = {
    JobKind.generate_concept_image,
    JobKind.generate_shape,
    JobKind.generate_texture,
    JobKind.rig,
    JobKind.generate_motion,
    JobKind.render_video,
}


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    canceled = "canceled"


class JobFailureKind(str, Enum):
    oom = "oom"
    model_error = "model_error"
    timeout = "timeout"
    invalid_input = "invalid_input"
    unknown = "unknown"


class JobProgress(StrictModel):
    stage: str = ""
    percent: float = Field(0.0, ge=0, le=100)
    eta_seconds: float | None = None
    vram_used_mb: int | None = None
    message: str = ""


class JobCreate(StrictModel):
    kind: JobKind
    params: dict[str, Any] = Field(default_factory=dict)


class Job(StrictModel):
    id: str = Field(..., pattern=r"^job_[0-9a-z]{26}$")
    kind: JobKind
    status: JobStatus = JobStatus.queued
    params: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None
    progress: JobProgress = Field(default_factory=JobProgress)
    failure_kind: JobFailureKind | None = None
    error: str | None = None
    attempt: int = Field(1, ge=1)
    created_at: datetime = Field(default_factory=utcnow)
    started_at: datetime | None = None
    finished_at: datetime | None = None
