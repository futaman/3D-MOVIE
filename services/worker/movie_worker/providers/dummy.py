"""GPU なしで配管を通すための疑似プロバイダ。

実際に読み込める GLB / PNG / MP4 を出力するので、Web のビューアやレンダリング経路の動作確認に使える。
"""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image

from ..config import get_worker_settings
from .base import (
    ConceptImageProvider,
    ConceptImageRequest,
    ProgressFn,
    Renderer,
    RenderRequest,
    RenderResult,
    RigProvider,
    RigRequest,
    RigResult,
    ShapeProvider,
    ShapeRequest,
    ShapeResult,
    TextureProvider,
    TextureRequest,
    TextureResult,
)


def _seeded(seed: int | None) -> np.random.Generator:
    return np.random.default_rng(seed if seed is not None else int(time.time()))


class DummyShape(ShapeProvider):
    name = "dummy-shape"

    def generate(self, req: ShapeRequest, progress: ProgressFn) -> ShapeResult:
        rng = _seeded(req.seed)
        progress("shape", 10, "building placeholder mesh")
        if req.kind == "humanoid":
            # 身長 1.7m のカプセル(人型の代用)
            mesh = trimesh.creation.capsule(radius=0.25, height=1.2, count=[16, 16])
            mesh.apply_translation([0, 0.85, 0])
        else:
            kind = rng.choice(["box", "cylinder", "icosphere"])
            if kind == "box":
                mesh = trimesh.creation.box(extents=[0.3, 0.4, 0.3])
            elif kind == "cylinder":
                mesh = trimesh.creation.cylinder(radius=0.15, height=0.4)
            else:
                mesh = trimesh.creation.icosphere(subdivisions=2, radius=0.2)
            mesh.apply_translation([0, float(-mesh.bounds[0][1]), 0])
        req.out_dir.mkdir(parents=True, exist_ok=True)
        out = req.out_dir / "shape.glb"
        mesh.export(out)
        progress("shape", 100, "done")
        return ShapeResult(mesh_path=out, triangles=len(mesh.faces), model_name=self.name)


class DummyTexture(TextureProvider):
    name = "dummy-texture"

    def generate(self, req: TextureRequest, progress: ProgressFn) -> TextureResult:
        progress("texture", 10, "painting placeholder texture")
        mesh = trimesh.load(req.mesh_path, force="mesh")
        rng = _seeded(hash(req.prompt) % (2**32))
        color = (rng.integers(60, 220, size=3)).tolist()
        img = Image.new("RGB", (req.resolution, req.resolution), tuple(color))
        req.out_dir.mkdir(parents=True, exist_ok=True)
        albedo = req.out_dir / "albedo.png"
        img.save(albedo)
        mesh.visual = trimesh.visual.ColorVisuals(mesh, face_colors=color + [255])
        out = req.out_dir / "model.glb"
        mesh.export(out)
        progress("texture", 100, "done")
        return TextureResult(glb_path=out, textures={"albedo": albedo}, model_name=self.name)


class DummyRig(RigProvider):
    name = "dummy-rig"

    def rig(self, req: RigRequest, progress: ProgressFn) -> RigResult:
        progress("rig", 50, "placeholder rig (copy)")
        req.out_dir.mkdir(parents=True, exist_ok=True)
        out = req.out_dir / "rigged.glb"
        out.write_bytes(Path(req.glb_path).read_bytes())
        progress("rig", 100, "done")
        return RigResult(glb_path=out, bone_count=0, validated=False, model_name=self.name)


class DummyConceptImage(ConceptImageProvider):
    name = "dummy-concept"

    def generate(self, req: ConceptImageRequest, progress: ProgressFn) -> Path:
        rng = _seeded(req.seed)
        img = Image.fromarray(rng.integers(0, 255, size=(512, 512, 3), dtype=np.uint8))
        req.out_dir.mkdir(parents=True, exist_ok=True)
        out = req.out_dir / "concept.png"
        img.save(out)
        progress("concept_image", 100, "done")
        return out


class DummyRenderer(Renderer):
    """ffmpeg のテストパターンで指定長の MP4 を作る。Blender なしでレンダリング経路を確認する用。"""

    name = "dummy-render"

    def render(self, req: RenderRequest, progress: ProgressFn) -> RenderResult:
        import json

        scene = json.loads(Path(req.scene_json).read_text(encoding="utf-8"))
        fps = scene["render"]["fps"]
        w, h = scene["render"]["width"], scene["render"]["height"]
        duration = float(scene["duration"])
        frames = int(round(duration * fps))
        req.out_dir.mkdir(parents=True, exist_ok=True)
        out = req.out_dir / "render.mp4"
        progress("render", 10, f"ffmpeg testsrc {w}x{h}@{fps} x{frames}")
        t0 = time.time()
        subprocess.run(
            [get_worker_settings().ffmpeg_bin, "-y", "-loglevel", "error", "-f", "lavfi",
             "-i", f"testsrc=size={w}x{h}:rate={fps}", "-frames:v", str(frames),
             "-pix_fmt", "yuv420p", "-c:v", "libx264", str(out)],
            check=True,
        )
        spf = (time.time() - t0) / max(frames, 1)
        progress("render", 100, "done")
        return RenderResult(video_path=out, frames=frames, seconds_per_frame=spf, model_name=self.name)
