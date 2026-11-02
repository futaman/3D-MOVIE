from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import Field

from .common import StrictModel, Transform, Vec3

__all__ = [
    "SceneNode",
    "Attachment",
    "MotionClipRef",
    "TransformKeyframe",
    "Track",
    "CameraPresetName",
    "Camera",
    "LightPresetName",
    "Lighting",
    "Background",
    "RenderSettings",
    "Scene",
]


class SceneNode(StrictModel):
    """シーンに配置された 1 オブジェクト。"""

    id: str = Field(..., pattern=r"^node_[0-9a-z]{8,}$")
    asset_id: str
    name: str
    transform: Transform = Field(default_factory=Transform)
    visible: bool = True


class Attachment(StrictModel):
    """小物を人型のボーンへ取り付ける。time で開始、until で外れる(None なら最後まで)。"""

    prop_node_id: str
    target_node_id: str
    bone: str = Field(..., examples=["hand_r"])
    attach_point: str = "grip"
    time: float = Field(0.0, ge=0)
    until: float | None = None


class MotionClipRef(StrictModel):
    motion_asset_id: str
    start: float = Field(0.0, ge=0, description="タイムライン上の開始秒")
    duration: float | None = Field(None, description="None ならクリップの長さ")
    speed: float = Field(1.0, gt=0)
    loop: bool = False
    blend_in: float = Field(0.2, ge=0)
    blend_out: float = Field(0.2, ge=0)
    trim_start: float = Field(0.0, ge=0)


class TransformKeyframe(StrictModel):
    time: float = Field(..., ge=0)
    transform: Transform
    easing: Literal["linear", "ease_in", "ease_out", "ease_in_out"] = "ease_in_out"


class Track(StrictModel):
    """ノード 1 つ分のアニメーショントラック。"""

    node_id: str
    clips: list[MotionClipRef] = Field(default_factory=list, description="humanoid のみ")
    keyframes: list[TransformKeyframe] = Field(default_factory=list, description="ルートのトランスフォーム")


class CameraPresetName(str, Enum):
    static = "static"
    push_in = "push_in"
    pull_out = "pull_out"
    orbit = "orbit"
    low_angle = "low_angle"
    follow = "follow"


class Camera(StrictModel):
    preset: CameraPresetName = CameraPresetName.static
    target_node_id: str | None = Field(None, description="注視・追従対象")
    fov_deg: float = Field(40.0, gt=1, lt=170)
    keyframes: list[TransformKeyframe] = Field(default_factory=list, description="手動キーフレーム。あればプリセットより優先")
    depth_of_field: bool = False
    focus_distance_m: float | None = None


class LightPresetName(str, Enum):
    studio = "studio"
    outdoor_day = "outdoor_day"
    sunset = "sunset"
    night_street = "night_street"
    neon = "neon"


class Lighting(StrictModel):
    preset: LightPresetName = LightPresetName.studio
    hdri: str | None = Field(None, description="data/hdri 配下のファイル名")
    intensity: float = Field(1.0, ge=0)


class Background(StrictModel):
    kind: Literal["color", "hdri", "floor", "environment_asset"] = "color"
    color: str = Field("#1e1e24", pattern=r"^#[0-9a-fA-F]{6}$")
    environment_asset_id: str | None = None


class RenderSettings(StrictModel):
    width: int = Field(1920, ge=256, le=3840)
    height: int = Field(1080, ge=256, le=2160)
    fps: Literal[24, 30, 60] = 24
    format: Literal["mp4", "webm", "png_sequence", "webm_alpha"] = "mp4"
    engine: Literal["eevee", "cycles", "viewport"] = "eevee"
    motion_blur: bool = False
    bloom: bool = False
    samples: int = Field(64, ge=1, le=4096)


class Scene(StrictModel):
    """Studio のシーン定義。ブラウザ(Three.js)と Blender の両インポータがこれを解釈する。"""

    schema_version: Literal["1.0.0"] = "1.0.0"
    id: str = Field(..., pattern=r"^scn_[0-9a-z]{26}$")
    name: str
    duration: float = Field(10.0, gt=0, le=600)
    nodes: list[SceneNode] = Field(default_factory=list)
    tracks: list[Track] = Field(default_factory=list)
    attachments: list[Attachment] = Field(default_factory=list)
    camera: Camera = Field(default_factory=Camera)
    lighting: Lighting = Field(default_factory=Lighting)
    background: Background = Field(default_factory=Background)
    render: RenderSettings = Field(default_factory=RenderSettings)
    gravity_floor_y: float = Field(0.0, description="接地判定に使う床の高さ")
    up: Vec3 = Field(default_factory=lambda: [0.0, 1.0, 0.0])
