"""フェーズ 0: Mixamo の FBX を std-humanoid-v1 の GLB に変換して data/motions/ に置く。

Blender をヘッドレスで使う:
    blender -b --python scripts/phase0/import_mixamo.py -- --in data/raw/mixamo --out data/motions

Mixamo のダウンロード設定(推奨): Format=FBX Binary, Skin=Without Skin, FPS=30, Keyframe Reduction=none
ボーン名は "mixamorig:Hips" 形式 → "hips" 形式へ正規化する(BONE_MAP)。
MVP では Web の「モーション取り込みウィザード」からこのスクリプトを import_motion ジョブとして呼ぶ。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy  # type: ignore

BONE_MAP = {
    "Hips": "hips", "Spine": "spine", "Spine1": "spine1", "Spine2": "spine2", "Neck": "neck", "Head": "head",
    "HeadTop_End": "head_top_end",
    "LeftShoulder": "shoulder_l", "LeftArm": "arm_l", "LeftForeArm": "forearm_l", "LeftHand": "hand_l",
    "RightShoulder": "shoulder_r", "RightArm": "arm_r", "RightForeArm": "forearm_r", "RightHand": "hand_r",
    "LeftUpLeg": "upleg_l", "LeftLeg": "leg_l", "LeftFoot": "foot_l", "LeftToeBase": "toebase_l", "LeftToe_End": "toe_end_l",
    "RightUpLeg": "upleg_r", "RightLeg": "leg_r", "RightFoot": "foot_r", "RightToeBase": "toebase_r", "RightToe_End": "toe_end_r",
}
FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"]
for side, s in (("Left", "l"), ("Right", "r")):
    for fi in FINGERS:
        for n in range(1, 5):
            BONE_MAP[f"{side}Hand{fi}{n}"] = f"hand_{s}_{fi.lower()}{n}"


def normalize_bone(name: str) -> str:
    base = name.split(":")[-1]
    return BONE_MAP.get(base, base.lower())


def convert(fbx: Path, out_dir: Path) -> Path:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(fbx), automatic_bone_orientation=False, ignore_leaf_bones=False)
    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    if arm is None:
        raise RuntimeError(f"no armature in {fbx}")
    for b in arm.data.bones:
        b.name = normalize_bone(b.name)
    if arm.animation_data and arm.animation_data.action:
        arm.animation_data.action.name = fbx.stem
    # Mixamo の FBX は cm 単位(スケール 0.01)で来るので 1.0 に正規化
    arm.scale = (1, 1, 1)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    out = out_dir / f"{fbx.stem}.glb"
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_animations=True, export_skins=True,
                              export_apply=True, use_selection=False)
    return out


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    fbxs = sorted(Path(args.inp).glob("*.fbx"))
    print(f"{len(fbxs)} files")
    for fbx in fbxs:
        try:
            print("ok ", convert(fbx, out_dir))
        except Exception as e:  # noqa: BLE001
            print("NG ", fbx.name, e)


if __name__ == "__main__":
    main()
