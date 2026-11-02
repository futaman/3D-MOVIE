"""生成系ステージ。1 ジョブ = 1 ステージ。アセットを更新して結果 dict を返す。

params 規約:
  generate_shape   : {asset_id, quality?}            → files.glb に shape.glb(テクスチャなし)
  generate_texture : {asset_id, quality?}            → files.glb を model.glb に更新、textures.albedo
  rig              : {asset_id}                      → files.glb を rigged.glb に、rig 情報を記録(humanoid のみ)
  generate_concept_image : {asset_id, quality?}      → files.source_images に追加
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from movie_schema import AssetKind, RigInfo

from ..providers import registry
from ..providers.base import ConceptImageRequest, ProgressFn, RigRequest, ShapeRequest, TextureRequest
from .common import asset_dir, data_dir, load_asset, rel


def _ref_images(asset) -> list[Path]:
    return [data_dir() / p for p in (asset.prompt.ref_images if asset.prompt else [])] + \
           [data_dir() / p for p in asset.files.source_images]


def generate_concept_image(params: dict[str, Any], progress: ProgressFn) -> dict[str, Any]:
    asset = load_asset(params["asset_id"])
    if not asset.prompt:
        raise ValueError("asset has no prompt")
    out = registry.concept_image_provider().generate(
        ConceptImageRequest(prompt=asset.prompt.normalized_text or asset.prompt.text,
                            negative=asset.prompt.negative, seed=asset.prompt.seed, out_dir=asset_dir(asset)),
        progress)
    asset.files.source_images.append(rel(out))
    asset.pipeline.concept_image = registry.concept_image_provider().name
    from .common import save_asset

    save_asset(asset)
    return {"asset_id": asset.id, "image": rel(out)}


def generate_shape(params: dict[str, Any], progress: ProgressFn) -> dict[str, Any]:
    asset = load_asset(params["asset_id"])
    if not asset.prompt:
        raise ValueError("asset has no prompt")
    provider = registry.shape_provider()
    res = provider.generate(
        ShapeRequest(prompt=asset.prompt.normalized_text or asset.prompt.text, negative=asset.prompt.negative,
                     seed=asset.prompt.seed, ref_images=_ref_images(asset), kind=asset.kind.value,
                     quality=params.get("quality", "high"), out_dir=asset_dir(asset)),
        progress)
    asset.files.glb = rel(res.mesh_path)
    asset.stats.triangles = res.triangles
    asset.pipeline.shape = res.model_name
    from .common import save_asset

    save_asset(asset)
    return {"asset_id": asset.id, "glb": asset.files.glb, "triangles": res.triangles}


def generate_texture(params: dict[str, Any], progress: ProgressFn) -> dict[str, Any]:
    asset = load_asset(params["asset_id"])
    if not asset.files.glb or not asset.prompt:
        raise ValueError("asset has no mesh or prompt")
    provider = registry.texture_provider()
    res = provider.generate(
        TextureRequest(mesh_path=data_dir() / asset.files.glb, prompt=asset.prompt.normalized_text or asset.prompt.text,
                       ref_images=_ref_images(asset), quality=params.get("quality", "high"),
                       resolution={"high": 1024, "medium": 768, "low": 512}[params.get("quality", "high")],
                       out_dir=asset_dir(asset)),
        progress)
    asset.files.glb = rel(res.glb_path)
    asset.files.textures = {k: rel(v) for k, v in res.textures.items()}
    if res.textures:
        from PIL import Image

        asset.stats.texture_size = Image.open(next(iter(res.textures.values()))).size[0]
    asset.pipeline.texture = res.model_name
    from .common import save_asset

    save_asset(asset)
    return {"asset_id": asset.id, "glb": asset.files.glb}


def rig(params: dict[str, Any], progress: ProgressFn) -> dict[str, Any]:
    asset = load_asset(params["asset_id"])
    if asset.kind != AssetKind.humanoid:
        raise ValueError("rig is only for humanoid assets")
    if not asset.files.glb:
        raise ValueError("asset has no mesh")
    res = registry.rig_provider().rig(RigRequest(glb_path=data_dir() / asset.files.glb, out_dir=asset_dir(asset)),
                                      progress)
    asset.files.glb = rel(res.glb_path)
    asset.rig = RigInfo(bone_count=res.bone_count, validated=res.validated)
    asset.pipeline.rig = res.model_name
    from .common import save_asset

    save_asset(asset)
    return {"asset_id": asset.id, "glb": asset.files.glb, "bones": res.bone_count}
