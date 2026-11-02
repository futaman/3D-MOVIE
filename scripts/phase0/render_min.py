"""フェーズ 0: Blender EEVEE 最小レンダリングの疎通と 1 フレームあたり秒数の実測。

ライブラリにある任意の GLB を 1 つ配置した 2 秒のシーンを書き出し、BlenderRenderer で MP4 にする。

    python scripts/phase0/render_min.py --glb data/assets/<id>/v1/model.glb --engine eevee --res 1080
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from movie_schema import Scene, SceneNode
from movie_worker.providers.base import RenderRequest
from movie_worker.providers.blender_renderer import BlenderRenderer

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", required=True, help="DATA_DIR からの相対、または絶対パス")
    ap.add_argument("--engine", default="eevee", choices=["eevee", "cycles"])
    ap.add_argument("--res", type=int, default=1080)
    ap.add_argument("--seconds", type=float, default=2.0)
    ap.add_argument("--data", default=str(ROOT / "data"))
    args = ap.parse_args()

    data = Path(args.data)
    glb = Path(args.glb)
    rel = str(glb.resolve().relative_to(data.resolve())) if glb.is_absolute() else args.glb
    scene = Scene(id="scn_" + "0" * 26, name="render_min", duration=args.seconds,
                  nodes=[SceneNode(id="node_bench001", asset_id="ast_" + "0" * 26, name="bench")])
    scene.render.width, scene.render.height = (int(args.res * 16 / 9), args.res)
    scene.render.engine = args.engine
    out_dir = data / "bench" / "render" / time.strftime("%Y%m%d_%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "scene.json").write_text(json.dumps(scene.model_dump(mode="json"), indent=2), encoding="utf-8")
    (out_dir / "assets.json").write_text(json.dumps({"ast_" + "0" * 26: {"files": {"glb": rel}}}), encoding="utf-8")

    res = BlenderRenderer().render(
        RenderRequest(scene_json=out_dir / "scene.json", asset_root=data, out_dir=out_dir, engine=args.engine),
        lambda s, p, m: print(f"{s} {p:5.1f}% {m}"))
    print(f"video={res.video_path} frames={res.frames} sec/frame={res.seconds_per_frame:.2f}")


if __name__ == "__main__":
    main()
