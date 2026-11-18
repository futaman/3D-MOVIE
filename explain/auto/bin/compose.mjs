// 映像に、ナレーション・BGM・効果音を重ねて final.mp4 にする(音量は -14 LUFS にそろえる)。
// 使い方: node bin/compose.mjs episodes/<id>
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const out = path.join(process.argv[2], "out"), tm = JSON.parse(readFileSync(path.join(out, "timing.json"), "utf8"));
const voices = tm.scenes.filter((s) => s.voice && existsSync(path.join(out, s.voice)));
const args = ["-y", "-loglevel", "error", "-i", path.join(out, "video.mp4"), "-i", path.join(out, "bed.wav")];
voices.forEach((s) => args.push("-i", path.join(out, s.voice)));
const f = [`[1:a]volume=${voices.length ? 0.35 : 0.9}[bed]`];
voices.forEach((s, i) => f.push(`[${i + 2}:a]adelay=${Math.round(s.start * 1000)}:all=1[v${i}]`));
f.push(`[bed]${voices.map((_, i) => `[v${i}]`).join("")}amix=inputs=${voices.length + 1}:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11[a]`);
args.push("-filter_complex", f.join(";"), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(tm.total), "-movflags", "+faststart", path.join(out, "final.mp4"));
execFileSync("ffmpeg", args, { stdio: "inherit" });
console.log(`■ 合成: final.mp4(ナレーション ${voices.length} 本${voices.length ? "" : "・音声なしの下書き"})`);
