from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import Field

from .common import Quat, StrictModel, Vec3, utcnow

__all__ = [
    "AssetKind",
    "Style",
    "PromptSpec",
    "PipelineInfo",
    "AssetFiles",
    "AssetStats",
    "RigInfo",
    "AttachPoint",
    "Asset",
    "STD_HUMANOID_V1_BONES",
]


class AssetKind(str, Enum):
    humanoid = "humanoid"
    prop = "prop"
    motion = "motion"
    environment = "environment"
    audio = "audio"


class Style(str, Enum):
    realistic = "realistic"
    semireal = "semireal"
    anime = "anime"
    stylized = "stylized"


class PromptSpec(StrictModel):
    text: str = Field(..., min_length=1, max_length=2000)
    negative: str = ""
    style: Style = Style.semireal
    seed: int | None = None
    ref_images: list[str] = Field(default_factory=list, description="参照画像のストレージパス")
    normalized_text: str | None = Field(None, description="LLM が整形した実際に投入したプロンプト")


class PipelineInfo(StrictModel):
    """どのモデル / バージョンで作られたか。再現性と比較ベンチのため記録する。"""

    concept_image: str | None = None
    shape: str | None = None
    texture: str | None = None
    rig: str | None = None


class AssetFiles(StrictModel):
    glb: str | None = Field(None, description="正となる GLB のパス(DATA_DIR からの相対)")
    textures: dict[str, str] = Field(default_factory=dict, description="albedo / normal / orm など")
    thumbnail: str | None = None
    turntable: str | None = None
    source_images: list[str] = Field(default_factory=list)


class AssetStats(StrictModel):
    triangles: int | None = None
    materials: int | None = None
    texture_size: int | None = None
    height_m: float | None = Field(None, description="人型の身長(1.7m 基準に正規化)")
    bounds: Vec3 | None = Field(None, description="バウンディングボックスのサイズ")


class RigInfo(StrictModel):
    skeleton: Literal["std-humanoid-v1"] = "std-humanoid-v1"
    bone_count: int = 65
    blendshapes: list[str] = Field(default_factory=list)
    validated: bool = Field(False, description="テストポーズで破綻がないことを確認済みか")


class AttachPoint(StrictModel):
    """小物を人型のボーンに持たせるための基準点(小物側のローカル座標)。"""

    name: str = Field(..., examples=["grip", "top", "bottom"])
    bone_hint: str | None = Field(None, description="推奨ボーン(hand_r など)")
    offset: Vec3 = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    rotation: Quat = Field(default_factory=lambda: [0.0, 0.0, 0.0, 1.0])


class Asset(StrictModel):
    id: str = Field(..., pattern=r"^ast_[0-9a-z]{26}$", description="ULID ベース")
    kind: AssetKind
    name: str = Field(..., min_length=1, max_length=200)
    version: int = Field(1, ge=1)
    parent_id: str | None = Field(None, description="派生元アセット")
    prompt: PromptSpec | None = None
    pipeline: PipelineInfo = Field(default_factory=PipelineInfo)
    files: AssetFiles = Field(default_factory=AssetFiles)
    stats: AssetStats = Field(default_factory=AssetStats)
    rig: RigInfo | None = Field(None, description="humanoid のみ")
    attach_points: list[AttachPoint] = Field(default_factory=list, description="prop のみ")
    tags: list[str] = Field(default_factory=list)
    owner_id: str = Field("local", description="将来のマルチユーザー化用。UI には出さない")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


# std-humanoid-v1: Mixamo 互換のボーン名(主要部のみ。指は hand_*_{thumb,index,middle,ring,pinky}{1..4})
STD_HUMANOID_V1_BONES: list[str] = [
    "hips",
    "spine", "spine1", "spine2",
    "neck", "head", "head_top_end",
    "shoulder_l", "arm_l", "forearm_l", "hand_l",
    "shoulder_r", "arm_r", "forearm_r", "hand_r",
    "upleg_l", "leg_l", "foot_l", "toebase_l", "toe_end_l",
    "upleg_r", "leg_r", "foot_r", "toebase_r", "toe_end_r",
]
