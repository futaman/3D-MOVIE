"""プロバイダ抽象。実モデル(Hunyuan3D, UniRig, Blender...)と dummy を同じ型で差し替える。

すべてのメソッドは同期。進捗は `progress(stage, percent, message)` コールバックで報告する。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

ProgressFn = Callable[[str, float, str], None]


@dataclass
class ShapeRequest:
    prompt: str
    negative: str = ""
    seed: int | None = None
    ref_images: list[Path] = field(default_factory=list)
    kind: str = "prop"  # humanoid | prop
    quality: str = "high"  # high | medium | low(OOM フォールバック)
    out_dir: Path = Path(".")


@dataclass
class ShapeResult:
    mesh_path: Path  # テクスチャなし GLB
    triangles: int
    model_name: str


@dataclass
class TextureRequest:
    mesh_path: Path
    prompt: str
    ref_images: list[Path] = field(default_factory=list)
    resolution: int = 1024
    quality: str = "high"
    out_dir: Path = Path(".")


@dataclass
class TextureResult:
    glb_path: Path  # テクスチャ込み GLB
    textures: dict[str, Path]
    model_name: str


@dataclass
class RigRequest:
    glb_path: Path
    out_dir: Path = Path(".")


@dataclass
class RigResult:
    glb_path: Path  # std-humanoid-v1 スケルトン付き GLB
    bone_count: int
    validated: bool
    model_name: str


@dataclass
class ConceptImageRequest:
    prompt: str
    negative: str = ""
    seed: int | None = None
    out_dir: Path = Path(".")


@dataclass
class RenderRequest:
    scene_json: Path
    asset_root: Path
    out_dir: Path
    engine: str = "eevee"


@dataclass
class RenderResult:
    video_path: Path
    frames: int
    seconds_per_frame: float
    model_name: str


class ShapeProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    def generate(self, req: ShapeRequest, progress: ProgressFn) -> ShapeResult: ...


class TextureProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    def generate(self, req: TextureRequest, progress: ProgressFn) -> TextureResult: ...


class RigProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    def rig(self, req: RigRequest, progress: ProgressFn) -> RigResult: ...


class ConceptImageProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    def generate(self, req: ConceptImageRequest, progress: ProgressFn) -> Path: ...


class Renderer(ABC):
    name: str = "abstract"

    @abstractmethod
    def render(self, req: RenderRequest, progress: ProgressFn) -> RenderResult: ...
