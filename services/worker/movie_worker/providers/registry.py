from __future__ import annotations

from ..config import get_worker_settings
from . import dummy, hunyuan3d
from .base import ConceptImageProvider, Renderer, RigProvider, ShapeProvider, TextureProvider

SHAPE: dict[str, type[ShapeProvider]] = {"dummy": dummy.DummyShape, "hunyuan3d": hunyuan3d.Hunyuan3DShape}
TEXTURE: dict[str, type[TextureProvider]] = {"dummy": dummy.DummyTexture, "hunyuan3d": hunyuan3d.Hunyuan3DTexture}
RIG: dict[str, type[RigProvider]] = {"dummy": dummy.DummyRig}
CONCEPT: dict[str, type[ConceptImageProvider]] = {"dummy": dummy.DummyConceptImage}
RENDER: dict[str, type[Renderer]] = {"dummy": dummy.DummyRenderer}


def _pick(table: dict, key: str, label: str):
    if key not in table:
        raise KeyError(f"unknown {label} provider '{key}'. available: {sorted(table)}")
    return table[key]()


def shape_provider() -> ShapeProvider:
    return _pick(SHAPE, get_worker_settings().shape_provider, "shape")


def texture_provider() -> TextureProvider:
    return _pick(TEXTURE, get_worker_settings().texture_provider, "texture")


def rig_provider() -> RigProvider:
    return _pick(RIG, get_worker_settings().rig_provider, "rig")


def concept_image_provider() -> ConceptImageProvider:
    return _pick(CONCEPT, get_worker_settings().concept_image_provider, "concept image")


def renderer() -> Renderer:
    key = get_worker_settings().renderer
    if key == "blender":
        from .blender_renderer import BlenderRenderer

        return BlenderRenderer()
    return _pick(RENDER, key, "renderer")
