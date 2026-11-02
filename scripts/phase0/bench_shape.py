"""フェーズ 0: 形状生成プロバイダの比較ベンチ。

同一プロンプトセット(prompts.yaml)を各プロバイダで回し、所要時間・ピーク VRAM・三角形数・成否を CSV に記録する。
GLB は out/<provider>/<kind>_<i>.glb に保存し、目視比較に使う。

    python scripts/phase0/bench_shape.py --providers dummy --out data/bench/shape
    python scripts/phase0/bench_shape.py --providers hunyuan3d,hunyuan3d-mini --quality medium

評価観点(人型): A ポーズになっているか / 左右対称 / 手足の分離 / 顔の破綻 / 穴の有無
評価観点(小物): シルエットの正確さ / 細部(取っ手・鎖など) / 底面の平ら度
"""
from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

import yaml

from movie_worker.providers import registry
from movie_worker.providers.base import ShapeRequest
from movie_worker.vram import OutOfMemory, release

ROOT = Path(__file__).resolve().parents[2]


def peak_vram_mb() -> int | None:
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            return int(torch.cuda.max_memory_allocated() / 1024 / 1024)
    except ImportError:
        pass
    return None


def reset_peak() -> None:
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            torch.cuda.reset_peak_memory_stats()
    except ImportError:
        pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--providers", default="dummy", help="カンマ区切り。registry.SHAPE のキー")
    ap.add_argument("--prompts", default=str(Path(__file__).with_name("prompts.yaml")))
    ap.add_argument("--out", default=str(ROOT / "data" / "bench" / "shape"))
    ap.add_argument("--quality", default="high")
    ap.add_argument("--limit", type=int, default=0, help="各種別の先頭 N 件だけ(0 で全件)")
    args = ap.parse_args()

    prompts = yaml.safe_load(Path(args.prompts).read_text(encoding="utf-8"))
    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)
    csv_path = out_root / f"results_{time.strftime('%Y%m%d_%H%M%S')}.csv"

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["provider", "kind", "index", "prompt", "quality", "ok", "seconds", "peak_vram_mb", "triangles",
                    "error", "glb"])
        for pname in args.providers.split(","):
            # registry は env から選ぶので、ここでは直接テーブルを引く
            provider = registry.SHAPE[pname.replace("-mini", "")]()
            for kind in ("humanoid", "prop"):
                items = prompts[kind][: args.limit or None]
                for i, prompt in enumerate(items):
                    out_dir = out_root / pname / f"{kind}_{i:02d}"
                    reset_peak()
                    t0 = time.time()
                    ok, err, tris, glb = True, "", None, ""
                    try:
                        res = provider.generate(
                            ShapeRequest(prompt=prompt, kind=kind, quality=args.quality, seed=1234, out_dir=out_dir),
                            lambda s, p, m: None)
                        tris, glb = res.triangles, str(res.mesh_path)
                    except OutOfMemory as e:
                        ok, err = False, f"OOM: {e}"
                    except Exception as e:  # noqa: BLE001
                        ok, err = False, f"{type(e).__name__}: {e}"
                    finally:
                        release()
                    sec = round(time.time() - t0, 1)
                    w.writerow([pname, kind, i, prompt, args.quality, ok, sec, peak_vram_mb(), tris, err, glb])
                    f.flush()
                    print(f"[{pname}] {kind}_{i:02d} ok={ok} {sec}s vram={peak_vram_mb()} tris={tris} {err}")
    print("wrote", csv_path)


if __name__ == "__main__":
    main()
