from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    data_dir: Path = Path("./data")
    shape_provider: str = "dummy"
    texture_provider: str = "dummy"
    rig_provider: str = "dummy"
    concept_image_provider: str = "dummy"
    renderer: str = "dummy"
    vram_budget_mb: int = 11000  # RTX 3060 12GB のうち、OS・ブラウザ分を差し引いた目安
    blender_bin: str = "blender"
    ffmpeg_bin: str = "ffmpeg"


@lru_cache
def get_worker_settings() -> WorkerSettings:
    return WorkerSettings()
