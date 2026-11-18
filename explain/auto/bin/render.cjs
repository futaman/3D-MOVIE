// 台本と尺から、1 コマずつ描いて MP4(映像のみ)にする。あわせて場面ごとの確認用の静止画と QA の結果を書く。
// 使い方: node bin/render.cjs episodes/<id> [--fps 30] [--qa-only]
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path"), { pathToFileURL } = require("node:url");
const dir = path.resolve(process.argv[2]), out = path.join(dir, "out"), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const fps = +arg("--fps", 30), qaOnly = process.argv.includes("--qa-only");
(async () => {
  const ep = JSON.parse(fs.readFileSync(path.join(dir, "episode.json"), "utf8")), tm = JSON.parse(fs.readFileSync(path.join(out, "timing.json"), "utf8"));
  const is3d = ep.mode === "3d";
  const b = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", ...(process.env.AUTO_SHORT_SOFT_GL ? ["--use-gl=angle", "--use-angle=swiftshader"] : [])] }), p = await (await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(([ep, tm, v]) => { window.__EP = ep; window.__TIMING = tm; window.__VISUALS_URL = v; }, [ep, tm, pathToFileURL(path.join(dir, is3d ? "visuals3d.js" : "visuals.js")).href]);
  await p.goto(pathToFileURL(path.join(__dirname, "..", "lib", is3d ? "player3d.html" : "player.html")).href);
  await p.waitForFunction(() => window.__READY); await p.evaluate(() => document.fonts.ready);
  const clip = { x: 0, y: 0, width: 540, height: 960 };
  // QA: 各場面の 15%・60%・95% の静止画
  fs.mkdirSync(path.join(out, "qa"), { recursive: true });
  for (const s of tm.scenes) for (const f of [0.15, 0.6, 0.95]) { await p.evaluate((t) => window.renderAt(t), s.start + s.dur * f); if (f === 0.6) await p.screenshot({ path: path.join(out, "qa", `${s.id}.png`), clip }); }
  if (!qaOnly) {
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-r", String(fps), path.join(out, "video.mp4")], { stdio: ["pipe", "inherit", "inherit"] });
    const total = Math.ceil(tm.total * fps);
    for (let i = 0; i < total; i++) {
      await p.evaluate((t) => window.renderAt(t), i / fps);
      const img = await p.screenshot({ type: "jpeg", quality: 93, clip });
      if (!ff.stdin.write(img)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % 150 === 0) process.stdout.write(`\r  描画 ${i}/${total}`);
    }
    ff.stdin.end(); await new Promise((r) => ff.on("close", r)); process.stdout.write("\n");
  }
  const qa = [...new Set(await p.evaluate(() => window.__QA))].concat(errs);
  fs.writeFileSync(path.join(out, "qa", "report.json"), JSON.stringify({ problems: qa }, null, 2));
  console.log(`■ 映像: ${qaOnly ? "QA の静止画のみ" : `video.mp4(${tm.total.toFixed(1)} 秒、${fps} fps)`}、自動 QA の指摘 ${qa.length} 件`); qa.forEach((q) => console.log("  ! " + q));
  await b.close(); if (qa.length) process.exit(3);
})();
