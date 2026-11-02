from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.sqlite3"
    redis_url: str = "redis://localhost:6379/0"
    data_dir: Path = Path("./data")
    # rq: Redis キュー経由でワーカーに渡す / inline: 同一プロセスで即実行(テスト・GPU なし確認用)
    queue_backend: Literal["rq", "inline"] = "rq"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5-5"


@lru_cache
def get_settings() -> Settings:
    return Settings()
