// 確認シートを撮る: node shot.cjs <cells.json> <out.png>
const { chromium } = require("playwright"), path = require("path"), { pathToFileURL } = require("url"), fs = require("fs");
(async () => {
  const cells = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), rows = Math.ceil(cells.length / 3);
  const b = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader", "--allow-file-access-from-files"] });
  const p = await (await b.newContext({ viewport: { width: 540 * 3, height: 960 * rows } })).newPage();
  p.on("pageerror", (e) => console.log("[pageerror]", e.message)); p.on("console", (m) => m.type() === "error" && console.log("[console]", m.text().slice(0, 300)));
  await p.goto(pathToFileURL(path.join(__dirname, "sheet.html")).href); await p.evaluate((c) => window.drawSheet(c), cells);
  await p.locator("#gl").screenshot({ path: process.argv[3] }); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
