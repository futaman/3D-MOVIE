// ナレーションを VOICEVOX で合成し、長さから各場面の尺を決めて timing.json を書く。
// VOICEVOX が動いていない(または --silent)ときは、文字数から尺を見積もる(音声なし)。
// 使い方: node bin/tts.mjs episodes/<id> [--silent] [--speaker 13] [--speed 1.15]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const dir = process.argv[2], out = path.join(dir, "out"), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ep = JSON.parse(readFileSync(path.join(dir, "episode.json"), "utf8"));
const HOST = process.env.VOICEVOX_URL || "http://127.0.0.1:50021", speaker = arg("--speaker", ep.voice?.speaker ?? 13), speed = +arg("--speed", ep.voice?.speed ?? 1.15);
const PAD = 0.35, CPS = 7.2;
mkdirSync(path.join(out, "voice"), { recursive: true });
let live = !process.argv.includes("--silent");
if (live) { try { const r = await fetch(`${HOST}/version`, { signal: AbortSignal.timeout(2000) }); live = r.ok; } catch { live = false; } }
const wavDur = (buf) => { const rate = buf.readUInt32LE(28); let o = 12; while (o < buf.length - 8) { const id = buf.toString("ascii", o, o + 4), sz = buf.readUInt32LE(o + 4); if (id === "data") return sz / rate; o += 8 + sz; } return 0; };
const scenes = []; let t = 0;
for (const s of ep.scenes) {
  let dur, file = null;
  if (live) {
    const q = await (await fetch(`${HOST}/audio_query?speaker=${speaker}&text=${encodeURIComponent(s.narration)}`, { method: "POST" })).json();
    q.speedScale = speed; q.prePhonemeLength = 0.05; q.postPhonemeLength = 0.05;
    const wav = Buffer.from(await (await fetch(`${HOST}/synthesis?speaker=${speaker}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(q) })).arrayBuffer());
    file = path.join("voice", `${s.id}.wav`); writeFileSync(path.join(out, file), wav); dur = wavDur(wav) + PAD;
  } else dur = Math.max(1.6, s.narration.replace(/[、。\s]/g, "").length / CPS) + PAD;
  scenes.push({ id: s.id, start: +t.toFixed(3), dur: +dur.toFixed(3), voice: file }); t += dur;
}
writeFileSync(path.join(out, "timing.json"), JSON.stringify({ voice: live ? { engine: "VOICEVOX", speaker: +speaker, speed } : null, total: +t.toFixed(3), scenes }, null, 2));
console.log(`■ 音声: ${live ? `VOICEVOX(話者 ${speaker})で合成` : "音声なし(文字数から尺を見積もり)"}、合計 ${t.toFixed(1)} 秒`);
