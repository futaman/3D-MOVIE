// BGM と効果音をコードで合成して out/bed.wav に書く(素材ファイルを使わない)。
// 使い方: node bin/sfx.mjs episodes/<id>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const out = path.join(process.argv[2], "out"), tm = JSON.parse(readFileSync(path.join(out, "timing.json"), "utf8"));
const SR = 44100, n = Math.ceil((tm.total + 0.5) * SR), buf = new Float32Array(n);
const add = (t0, dur, f) => { const a = Math.floor(t0 * SR), b = Math.min(n, a + Math.floor(dur * SR)); for (let i = Math.max(0, a); i < b; i++) buf[i] += f((i - a) / SR, (i - a) / (b - a)); };
// BGM: 4 つの和音をゆっくり回し、8 分音符のやわらかい音を重ねる
const CH = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 207.65, 246.94]], BEAT = 0.5;
for (let t = 0, k = 0; t < tm.total; t += BEAT * 4, k++) {
  const ch = CH[k % 4];
  ch.forEach((f) => add(t, BEAT * 4, (x, u) => 0.035 * Math.sin(2 * Math.PI * f * x) * Math.sin(Math.PI * u)));
  for (let j = 0; j < 8; j++) { const f = ch[j % 3] * 2; add(t + j * BEAT / 2, 0.3, (x) => 0.05 * Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 14)); }
  add(t, 0.25, (x) => 0.12 * Math.sin(2 * Math.PI * (ch[0] / 4) * x) * Math.exp(-x * 10));
}
// 効果音: 場面の切り替わりに「ポッ」、最後の場面の頭に上がる音
tm.scenes.forEach((s, i) => { if (i) add(s.start, 0.12, (x) => 0.16 * Math.sin(2 * Math.PI * (700 + 2400 * x) * x) * Math.exp(-x * 30)); });
const last = tm.scenes[tm.scenes.length - 1]; [523.25, 659.25, 783.99].forEach((f, i) => add(last.start + i * 0.09, 0.5, (x) => 0.1 * Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 6)));
add(tm.total - 0.6, 0.6, () => 0); for (let i = Math.max(0, n - SR); i < n; i++) buf[i] *= (n - i) / SR;
const pcm = Buffer.alloc(44 + n * 2); pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + n * 2, 4); pcm.write("WAVEfmt ", 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), 44 + i * 2);
writeFileSync(path.join(out, "bed.wav"), pcm); console.log(`■ BGM・効果音: bed.wav(${tm.total.toFixed(1)} 秒)`);
