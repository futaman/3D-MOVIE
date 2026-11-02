from __future__ import annotations

from fastapi import APIRouter

from movie_schema import SCHEMA_VERSION

from ..config import get_settings
from ..events import redis_client

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    redis_ok = True
    try:
        redis_client().ping()
    except Exception:
        redis_ok = False
    return {"ok": True, "schema_version": SCHEMA_VERSION, "redis": redis_ok,
            "queue_backend": get_settings().queue_backend}
