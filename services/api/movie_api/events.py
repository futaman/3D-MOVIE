"""ジョブ進捗の配信。Redis Pub/Sub の `jobs` チャンネルにジョブ JSON を流し、WebSocket が購読する。"""
from __future__ import annotations

import json

import redis

from movie_schema import Job

from .config import get_settings

CHANNEL = "jobs"
_client: redis.Redis | None = None


def redis_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


def publish_job(job: Job) -> None:
    try:
        redis_client().publish(CHANNEL, job.model_dump_json())
    except redis.RedisError:
        # Redis が無い環境(inline テスト等)でも進捗更新自体は DB に残るので握りつぶす
        pass


def dumps(job: Job) -> str:
    return json.dumps(job.model_dump(mode="json"), ensure_ascii=False)
