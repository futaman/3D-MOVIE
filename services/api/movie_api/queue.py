"""ジョブ投入。

- rq     : Redis キュー `gpu` に積み、services/worker が取り出して実行する
- inline : その場で worker の run_job を呼ぶ(テストや GPU なしでの配管確認用)
"""
from __future__ import annotations

from rq import Queue

from .config import get_settings
from .events import redis_client

GPU_QUEUE = "gpu"
WORKER_ENTRYPOINT = "movie_worker.tasks.run_job"


def enqueue(job_id: str) -> None:
    settings = get_settings()
    if settings.queue_backend == "inline":
        from movie_worker.tasks import run_job  # 遅延 import(API 単体では worker 不要)

        run_job(job_id)
        return
    q = Queue(GPU_QUEUE, connection=redis_client(), default_timeout=60 * 60)
    q.enqueue(WORKER_ENTRYPOINT, job_id, job_id=job_id)
