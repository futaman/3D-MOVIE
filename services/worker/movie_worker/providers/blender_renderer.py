"""Blender(EEVEE)ヘッドレスレンダラ。`movie_worker/blender/import_scene.py` を blender -b で実行する。"""
from __future__ import annotations

import re
import subprocess
import time
from pathlib import Path

from ..config import get_worker_settings
from .base import ProgressFn, Renderer, RenderRequest, RenderResult

SCRIPT = Path(__file__).parent.parent / "blender" / "import_scene.py"
FRAME_RE = re.compile(r"Fra:(\d+)")


class BlenderRenderer(Renderer):
    name = "blender-eevee"

    def render(self, req: RenderRequest, progress: ProgressFn) -> RenderResult:
        s = get_worker_settings()
        req.out_dir.mkdir(parents=True, exist_ok=True)
        frames_dir = req.out_dir / "frames"
        frames_dir.mkdir(exist_ok=True)
        cmd = [s.blender_bin, "-b", "--python", str(SCRIPT), "--",
               "--scene", str(req.scene_json), "--assets", str(req.asset_root),
               "--out", str(frames_dir), "--engine", req.engine]
        t0 = time.time()
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        total = 0
        last = 0
        assert proc.stdout is not None
        for line in proc.stdout:
            if line.startswith("TOTAL_FRAMES="):
                total = int(line.split("=")[1])
            m = FRAME_RE.search(line)
            if m and total:
                last = int(m.group(1))
                progress("render", 5 + 85 * last / total, f"frame {last}/{total}")
        if proc.wait() != 0:
            raise RuntimeError("blender render failed")
        spf = (time.time() - t0) / max(total, 1)

        import json

        fps = json.loads(Path(req.scene_json).read_text(encoding="utf-8"))["render"]["fps"]
        out = req.out_dir / "render.mp4"
        progress("render", 92, "encoding mp4")
        subprocess.run([s.ffmpeg_bin, "-y", "-loglevel", "error", "-framerate", str(fps),
                        "-i", str(frames_dir / "frame_%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-crf", "18", str(out)], check=True)
        progress("render", 100, "done")
        return RenderResult(video_path=out, frames=total, seconds_per_frame=spf, model_name=self.name)
