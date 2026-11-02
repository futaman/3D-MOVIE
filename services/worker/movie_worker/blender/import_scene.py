"""Blender ヘッドレス: シーン JSON → EEVEE でフレーム連番を書き出す。

    blender -b --python import_scene.py -- --scene scene.json --assets /data --out frames/ --engine eevee

対応範囲(骨組み): ノードの GLB 配置、カメラプリセット、ライトプリセット、背景色、解像度/fps。
TODO(phase0): モーションクリップ適用(アクション読み込みとリターゲット)、アタッチ、キーフレーム、HDRI、DoF。
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy  # type: ignore
from mathutils import Vector  # type: ignore


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--scene", required=True)
    p.add_argument("--assets", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--engine", default="eevee")
    return p.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_node(node: dict, asset_root: Path, assets_by_id: dict) -> None:
    asset = assets_by_id.get(node["asset_id"])
    glb = asset and asset.get("files", {}).get("glb")
    if not glb:
        print(f"WARN: node {node['id']} has no glb, skipping")
        return
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(asset_root / glb))
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    empty = bpy.data.objects.new(node["name"], None)
    bpy.context.scene.collection.objects.link(empty)
    for r in roots:
        r.parent = empty
    t = node["transform"]
    # Scene JSON は Y-up / Blender は Z-up: (x, y, z) -> (x, -z, y)
    empty.location = Vector((t["position"][0], -t["position"][2], t["position"][1]))
    qx, qy, qz, qw = t["rotation"]
    empty.rotation_mode = "QUATERNION"
    empty.rotation_quaternion = (qw, qx, -qz, qy)
    empty.scale = (t["scale"][0], t["scale"][2], t["scale"][1])
    empty.hide_render = not node.get("visible", True)


def setup_camera(cam: dict, duration: float, fps: int) -> None:
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.angle = math.radians(cam["fov_deg"])
    cam_obj = bpy.data.objects.new("Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    preset = cam["preset"]
    target = Vector((0, 0, 1.0))
    frames = int(duration * fps)
    # TODO(phase0): target_node_id の実位置を使う。今はシーン中心 1m を注視
    if preset == "low_angle":
        start, end = Vector((0, -4, 0.4)), Vector((0, -4, 0.4))
    elif preset == "push_in":
        start, end = Vector((0, -6, 1.4)), Vector((0, -3, 1.2))
    elif preset == "pull_out":
        start, end = Vector((0, -3, 1.2)), Vector((0, -6, 1.4))
    else:
        start, end = Vector((0, -4.5, 1.3)), Vector((0, -4.5, 1.3))
    for f, pos in ((1, start), (max(frames, 2), end)):
        if preset == "orbit":
            pass  # 下で別処理
        cam_obj.location = pos
        cam_obj.keyframe_insert("location", frame=f)
    if preset == "orbit":
        for f in range(1, frames + 1, max(1, frames // 24)):
            a = 2 * math.pi * (f - 1) / max(frames - 1, 1)
            cam_obj.location = Vector((4.5 * math.sin(a), -4.5 * math.cos(a), 1.3))
            cam_obj.keyframe_insert("location", frame=f)
    track = cam_obj.constraints.new("TRACK_TO")
    anchor = bpy.data.objects.new("CameraTarget", None)
    anchor.location = target
    bpy.context.scene.collection.objects.link(anchor)
    track.target = anchor
    track.track_axis, track.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    if cam.get("depth_of_field"):
        cam_data.dof.use_dof = True
        cam_data.dof.focus_object = anchor


LIGHT_PRESETS = {
    "studio": [("SUN", (3, -3, 6), 3.0, (1, 1, 1)), ("AREA", (-3, -2, 3), 300, (0.9, 0.95, 1))],
    "outdoor_day": [("SUN", (2, -2, 8), 6.0, (1, 0.98, 0.9))],
    "sunset": [("SUN", (6, -6, 1.5), 4.0, (1, 0.6, 0.3)), ("AREA", (-3, -2, 3), 100, (0.5, 0.6, 1))],
    "night_street": [("POINT", (1.5, -1.5, 3.5), 800, (1, 0.8, 0.5)), ("AREA", (-3, 2, 3), 60, (0.4, 0.5, 1))],
    "neon": [("AREA", (-3, -2, 2.5), 400, (1, 0.1, 0.6)), ("AREA", (3, -2, 2.5), 400, (0.1, 0.8, 1))],
}


def setup_lighting(light: dict) -> None:
    for i, (kind, loc, energy, color) in enumerate(LIGHT_PRESETS.get(light["preset"], LIGHT_PRESETS["studio"])):
        data = bpy.data.lights.new(f"Light{i}", kind)
        data.energy = energy * light.get("intensity", 1.0)
        data.color = color
        obj = bpy.data.objects.new(f"Light{i}", data)
        obj.location = loc
        bpy.context.scene.collection.objects.link(obj)
        c = obj.constraints.new("TRACK_TO")
        c.target = bpy.data.objects.get("CameraTarget")
        c.track_axis, c.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    # TODO(phase0): HDRI(light["hdri"])を World に設定


def setup_world_and_render(scene_json: dict, engine: str, out_dir: Path) -> None:
    sc = bpy.context.scene
    r = scene_json["render"]
    sc.render.resolution_x, sc.render.resolution_y = r["width"], r["height"]
    sc.render.fps = r["fps"]
    sc.frame_start, sc.frame_end = 1, max(1, int(round(scene_json["duration"] * r["fps"])))
    sc.render.engine = "BLENDER_EEVEE_NEXT" if engine == "eevee" and hasattr(bpy.types, "SceneEEVEE") else \
        ("CYCLES" if engine == "cycles" else "BLENDER_EEVEE")
    if sc.render.engine.startswith("BLENDER_EEVEE"):
        sc.eevee.taa_render_samples = r["samples"]
        sc.eevee.use_bloom = r.get("bloom", False) if hasattr(sc.eevee, "use_bloom") else False
    sc.render.use_motion_blur = r.get("motion_blur", False)
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = str(out_dir / "frame_")
    sc.render.use_file_extension = True
    # 背景色
    world = bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    hexcol = scene_json["background"]["color"].lstrip("#")
    rgb = tuple(int(hexcol[i:i + 2], 16) / 255 for i in (0, 2, 4))
    bg.inputs[0].default_value = (*rgb, 1.0)
    if scene_json["background"]["kind"] == "floor":
        bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, scene_json.get("gravity_floor_y", 0)))


def main() -> None:
    args = parse_args()
    scene = json.loads(Path(args.scene).read_text(encoding="utf-8"))
    asset_root = Path(args.assets)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    # アセットのメタ情報は scene.json と同じ階層の assets.json(render パイプラインが書き出す)から読む。無ければ GLB 直指定を探す
    assets_path = Path(args.scene).with_name("assets.json")
    assets_by_id = json.loads(assets_path.read_text(encoding="utf-8")) if assets_path.exists() else {}

    reset_scene()
    for node in scene["nodes"]:
        import_node(node, asset_root, assets_by_id)
    setup_camera(scene["camera"], scene["duration"], scene["render"]["fps"])
    setup_lighting(scene["lighting"])
    setup_world_and_render(scene, args.engine, out_dir)
    print(f"TOTAL_FRAMES={bpy.context.scene.frame_end}", flush=True)
    bpy.ops.render.render(animation=True)


if __name__ == "__main__":
    main()
