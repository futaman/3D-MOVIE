// events.json と storyboard.json から字幕(ASS)を作り、ffmpeg で 1080×1920 の MP4 にする。
// 使い方: node build.mjs <出力ディレクトリ>
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const out = process.argv[2], here = path.dirname(new URL(import.meta.url).pathname);
const sb = JSON.parse(readFileSync(path.join(here, "storyboard.json"), "utf8"));
const ev = JSON.parse(readFileSync(path.join(out, "events.json"), "utf8"));
// 動画の中の印が反転したコマから、出来事の本当の時刻を求める(録画の開始と時計のずれをなくす)
{
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", path.join(out, "raw.webm"), "-vf", "fps=30,crop=16:16:4:4,scale=1:1,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  const flips = []; let prev = buf[0] > 128;
  for (let i = 1; i < buf.length; i++) { const v = buf[i] > 128; if (v !== prev) { flips.push(i / 30); prev = v; } }
  if (flips.length === ev.order.length || flips.length === ev.order.length - 1) {
    const clock = { ...ev };
    ev.order.forEach((k, i) => { ev[k] = i < flips.length ? flips[i] : flips[i - 1] + (clock[k] - clock[ev.order[i - 1]]); });
  } else console.warn(`印の反転 ${flips.length} 回 / 出来事 ${ev.order.length} 個: 時計の時刻をそのまま使います`);
}
const at = (s) => {
  const m = s.match(/^(\w+)(?:\+([\d.]+)(%?))?$/), base = ev[m[1]];
  if (!m[2]) return base;
  if (m[3] === "%") return base + (ev.equilibrium - ev.join) * (+m[2] / 100);
  return base + +m[2];
};
const times = sb.shots.map((s) => at(s.event));
const tc = (t) => { const h = Math.floor(t / 3600), mm = Math.floor(t / 60) % 60, ss = (t % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(mm).padStart(2, "0")}:${ss}`; };
const start = ev.start - 0.3, end = ev.end;
const SHIFT = 260; // 映像を下げる量(上のタイトル帯と重ならないように)
let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,IPAGothic,92,&H00111111,&H00111111,&H00FFFFFF,&H00FFFFFF,1,0,0,0,100,100,0,0,3,28,0,8,40,40,70,1
Style: Sub,IPAGothic,70,&H0000E6FF,&H0000E6FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,7,2,2,60,60,300,1
Style: Lbl,IPAGothic,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,5,0,0,0,1
Style: Note,IPAGothic,30,&H00C8C8C8,&H00C8C8C8,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,${tc(0)},${tc(end - start)},Title,,0,0,0,,${sb.title}
Dialogue: 0,${tc(0)},${tc(end - start)},Lbl,,0,0,0,,{\\pos(190,${SHIFT + 150})\\c&H758AFF&}p 型(ホウ素)
Dialogue: 0,${tc(0)},${tc(end - start)},Lbl,,0,0,0,,{\\pos(890,${SHIFT + 150})\\c&HF5E15F&}n 型(リン)
Dialogue: 0,${tc(0)},${tc(end - start)},Note,,0,0,0,,模式図・粒の数は実際より少なく描いています  MOSFET の内側(シミュレーター)
`;
sb.shots.forEach((s, i) => {
  const a = times[i] - start, b = (i + 1 < times.length ? times[i + 1] : end) - start;
  ass += `Dialogue: 0,${tc(Math.max(0, a))},${tc(b)},Sub,,0,0,0,,${s.text.replace(/\n/g, "\\N")}\n`;
});
writeFileSync(path.join(out, "subs.ass"), ass);
const outMp4 = path.join(out, "depletion.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", start.toFixed(2), "-i", path.join(out, "raw.webm"), "-t", (end - start).toFixed(2),
  "-vf", `${ev.crop ? `crop=${ev.crop.w}:${ev.crop.h}:${ev.crop.x}:0,` : ""}scale=1080:1920:flags=lanczos,pad=1080:${1920 + SHIFT}:0:${SHIFT}:color=0x0a1116,crop=1080:1920:0:0,fps=30,ass=${path.join(out, "subs.ass")}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", outMp4], { stdio: "inherit" });
console.log("wrote", outMp4, `(${(end - start).toFixed(1)} s)`);
