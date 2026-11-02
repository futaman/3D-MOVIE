"""RQ ワーカー起動。GPU キュー `gpu` を 1 プロセスで直列処理する。

    python -m movie_worker.main
"""
from __future__ import annotations

import logging

from rq import Queue, Worker

from movie_api.db import init_db
from movie_api.events import redis_client
from movie_api.queue import GPU_QUEUE


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    init_db()
    conn = redis_client()
    worker = Worker([Queue(GPU_QUEUE, connection=conn)], connection=conn)
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
