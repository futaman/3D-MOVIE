// 1 本を最初から最後まで作る。使い方: node bin/run.mjs episodes/<id> [--silent] [--fps 30] [--upload] [--strict]
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url)), dir = process.argv[2], rest = process.argv.slice(3);
if (!dir) { console.error("使い方: node bin/run.mjs episodes/<id> [--silent] [--upload]"); process.exit(1); }
const run = (f, extra = [], okCodes = [0]) => { const r = spawnSync("node", [path.join(here, f), dir, ...extra], { stdio: "inherit" }); if (!okCodes.includes(r.status)) { console.error(`\n中止: ${f} が失敗しました(コード ${r.status})`); process.exit(r.status || 1); } };
const pick = (...ks) => rest.flatMap((a, i) => (ks.includes(a) ? (a === "--fps" || a === "--speaker" || a === "--speed" ? [a, rest[i + 1]] : [a]) : []));
run("verify.mjs", pick("--strict"));
run("tts.mjs", pick("--silent", "--speaker", "--speed"));
run("sfx.mjs");
run("render.cjs", pick("--fps"));
run("compose.mjs");
run("meta.mjs");
if (rest.includes("--upload")) run("upload.mjs", pick("--allow-unverified"));
console.log(`\n完成: ${path.join(dir, "out", "final.mp4")}`);
