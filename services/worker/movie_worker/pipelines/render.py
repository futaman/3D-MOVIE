"""render_video: {scene_id, engine?} → DATA_DIR/renders/<scene_id>/<job_id>/render.mp4"""
from __future__ import annotations

import json
from typing import Any

from movie_api.db import AssetRow, SceneRow, session_scope

from ..providers import registry
from ..providers.base import ProgressFn, RenderRequest
from .common import data_dir, rel


def render_video(params: dict[str, Any], progress: ProgressFn, job_id: str) -> dict[str, Any]:
    with session_scope() as s:
        row = s.get(SceneRow, params["scene_id"])
        if row is None:
            raise ValueError(f"scene not found: {params['scene_id']}")
        scene = row.to_model()
    out_dir = data_dir() / "renders" / scene.id / job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    scene_json = out_dir / "scene.json"
    scene_json.write_text(json.dumps(scene.model_dump(mode="json"), ensure_ascii=False, indent=2), encoding="utf-8")
    # Blender スクリプトがノード → GLB を引けるよう、使用アセットのメタ情報も隣に書き出す
    with session_scope() as s:
        ids = {n.asset_id for n in scene.nodes}
        assets = {r.id: r.body for r in (s.get(AssetRow, i) for i in ids) if r is not None}
    (out_dir / "assets.json").write_text(json.dumps(assets, ensure_ascii=False), encoding="utf-8")
    res = registry.renderer().render(
        RenderRequest(scene_json=scene_json, asset_root=data_dir(), out_dir=out_dir,
                      engine=params.get("engine", scene.render.engine)), progress)
    return {"scene_id": scene.id, "video": rel(res.video_path), "frames": res.frames,
            "seconds_per_frame": round(res.seconds_per_frame, 3), "renderer": res.model_name}
