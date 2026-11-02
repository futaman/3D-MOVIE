from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Vec3 = Annotated[list[float], Field(min_length=3, max_length=3, description="[x, y, z]")]
Quat = Annotated[list[float], Field(min_length=4, max_length=4, description="[x, y, z, w]")]


def utcnow() -> datetime:
    return datetime.now(UTC)


class StrictModel(BaseModel):
    """未知フィールドを拒否する基底。スキーマの揺れを早期に検出する。"""

    model_config = ConfigDict(extra="forbid")


class Transform(StrictModel):
    position: Vec3 = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    rotation: Quat = Field(default_factory=lambda: [0.0, 0.0, 0.0, 1.0])
    scale: Vec3 = Field(default_factory=lambda: [1.0, 1.0, 1.0])
