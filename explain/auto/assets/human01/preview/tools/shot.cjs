const { chromium } = require("playwright"); const path = require("path"); const { pathToFileURL } = require("url");
(async () => {
  const spec = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8")), out = process.argv[3];
  const b = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"] });
  const rows = Math.ceil(spec.cells.length / spec.cols);
  const p = await (await b.newContext({ viewport: { width: spec.cw * spec.cols, height: spec.ch * rows } })).newPage();
  p.on("console", m => { if (m.type() === "error" || m.type() === "warning") console.log("[console]", m.text().slice(0, 300)); }); p.on("pageerror", e => console.log("[pageerror]", e.message));
  await p.goto(pathToFileURL(path.join(__dirname, "sheet.html")).href);
  const r = await p.evaluate(s => window.drawSheet(s), spec); if (process.argv[4]) console.log(JSON.stringify(r));
  await p.locator("#wrap").screenshot({ path: out }); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
