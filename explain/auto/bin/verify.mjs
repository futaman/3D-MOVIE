// 台本の数値をコードで再計算する。合わない主張があれば失敗(終了コード 1)。
// 使い方: node bin/verify.mjs episodes/<id>
import { readFileSync } from "node:fs";
import path from "node:path";
const dir = process.argv[2], ep = JSON.parse(readFileSync(path.join(dir, "episode.json"), "utf8"));
const R = 6371.0088, rad = (d) => d * Math.PI / 180;
const dist = (a, b) => { const dl = rad(b[0] - a[0]), dn = rad(b[1] - a[1]), h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const bearing = (a, b) => Math.atan2(Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0])), Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1])));
// 経路 a→b から点 c までの横のずれ [km] と、経路にそった距離 [km]
const xtrack = (a, b, c) => Math.abs(Math.asin(Math.sin(dist(a, c) / R) * Math.sin(bearing(a, c) - bearing(a, b))) * R);
const along = (a, b, c) => Math.acos(Math.cos(dist(a, c) / R) / Math.cos(xtrack(a, b, c) / R)) * R;
const names = Object.keys(ep.places || {}), vals = names.map((k) => ep.places[k]);
let bad = 0;
console.log(`■ 計算の検証: ${ep.title}`);
for (const c of ep.checks || []) {
  let v; try { v = new Function("Math", "dist", "xtrack", "along", ...names, `"use strict"; return (${c.expr});`)(Math, dist, xtrack, along, ...vals); } catch (e) { v = NaN; }
  const ok = Number.isFinite(v) && Math.abs(v - c.expect) <= (c.tol ?? 0) + 1e-9;
  if (!ok) bad++;
  console.log(`  ${ok ? "○" : "×"} ${c.claim}  → 計算値 ${Number.isFinite(v) ? v.toFixed(2) : "計算できない"}(台本 ${c.expect} ± ${c.tol ?? 0})`);
}
const open = (ep.facts || []).filter((f) => f.status === "unverified");
console.log(`■ 外部の事実: ${(ep.facts || []).length} 件(未確認 ${open.length} 件)`);
for (const f of ep.facts || []) console.log(`  ${f.status === "confirmed" ? "○" : f.status === "assumption" ? "仮" : "?"} ${f.claim} [${f.source}]`);
if (bad) { console.error(`計算が合わない主張が ${bad} 件あります。台本を直してください。`); process.exit(1); }
if (open.length && process.argv.includes("--strict")) { console.error("未確認の事実があります(--strict)。出典を確かめて status を confirmed にしてください。"); process.exit(2); }
