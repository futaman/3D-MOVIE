"""Hunyuan3D 2 プロバイダ(フェーズ 0 で実装)。

RTX 3060 12GB 向けの方針:
- shape と paint を同時に VRAM に置かない(別ジョブ)
- FP16、`enable_model_cpu_offload` 相当で RAM(48GB)へオフロード
- quality: high=octree 384 / medium=256 / low=192、テクスチャ high=1024 / medium=768 / low=512
- OOM は vram.hold が OutOfMemory に変換し、tasks.run_job が quality を一段下げて再試行する

参考実装の置き場所: data/models/hunyuan3d-2/(重みは Hugging Face から取得)
"""
from __future__ import annotations

from .base import (
    ProgressFn,
    ShapeProvider,
    ShapeRequest,
    ShapeResult,
    TextureProvider,
    TextureRequest,
    TextureResult,
)

QUALITY_TO_OCTREE = {"high": 384, "medium": 256, "low": 192}
QUALITY_TO_TEX_RES = {"high": 1024, "medium": 768, "low": 512}


class Hunyuan3DShape(ShapeProvider):
    name = "hunyuan3d-2-shape"

    def generate(self, req: ShapeRequest, progress: ProgressFn) -> ShapeResult:
        # TODO(phase0): hy3dgen.shapegen.Hunyuan3DDiTFlowMatchingPipeline を vram.hold 内でロードし、
        #   image-to-3D(ref_images[0] または concept image)で生成。octree_resolution=QUALITY_TO_OCTREE[req.quality]
        raise NotImplementedError("Hunyuan3D shape provider is implemented in phase 0")


class Hunyuan3DTexture(TextureProvider):
    name = "hunyuan3d-2-paint"

    def generate(self, req: TextureRequest, progress: ProgressFn) -> TextureResult:
        # TODO(phase0): hy3dgen.texgen.Hunyuan3DPaintPipeline。resolution=QUALITY_TO_TEX_RES[req.quality]
        raise NotImplementedError("Hunyuan3D paint provider is implemented in phase 0")
