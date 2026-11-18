// 実験カットを撮る: node shot.cjs [keisan|human01] [--video]   出力は out/
const http = require("http"), fs = require("fs"), path = require("path"), { spawn } = require("child_process"), { chromium } = require("playwright");
const root = path.resolve(__dirname, "../.."), who = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "keisan", video = process.argv.includes("--video"), out = path.join(__dirname, "out");
const mime = { ".html": "text/html", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".glb": "model/gltf-binary", ".json": "application/json" };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const b = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"] }), p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  p.on("console", (m) => m.type() === "error" && console.log("console:", m.text())); p.on("response", (r) => r.status() >= 400 && console.log("http", r.status(), r.url())); p.on("requestfailed", (r) => console.log("failed", r.url().slice(0, 120), r.failure().errorText)); p.on("pageerror", (e) => console.log("pageerror:", e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/lab/shot01/index.html?ch=${who}`); await p.waitForFunction("window.__READY", null, { timeout: 120000 });
  const err = await p.evaluate("window.__ERR"); if (err) { console.log(err); process.exit(1); }
  const dur = await p.evaluate("window.DUR");
  if (!video) { for (const t of [0.6, 1.75, 2.0, 2.2, 3.0, 4.4]) { await p.evaluate((t) => window.renderAt(t), t); await p.screenshot({ path: path.join(out, `${who}_${t}.png`) }); } }
  else { const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-r", "30", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", path.join(out, `${who}.mp4`)], { stdio: ["pipe", "inherit", "inherit"] });
    for (let i = 0; i < dur * 30; i++) { await p.evaluate((t) => window.renderAt(t), i / 30); ff.stdin.write(await p.screenshot({ type: "jpeg", quality: 92 })); } ff.stdin.end(); await new Promise((ok) => ff.on("close", ok)); }
  await b.close(); srv.close(); console.log("done", who);
})();
