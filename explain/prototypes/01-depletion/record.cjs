// シミュレーターの PN 接合の章を縦型で録画し、出来事の時刻を events.json に書く。
// 使い方: node record.cjs <MOSFET_SIM の index.html> <出力ディレクトリ> [three.min.js(CDN に届かない環境だけ)]
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const [page_html, outDir, three] = process.argv.slice(2);
const W = 1600, H = 900; // 横長で録画し、空乏層を中心に 9:16 で切り抜く(縦長で録るとカメラが遠ざかって小さくなるため)
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const t0 = Date.now();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: outDir, size: { width: W, height: H } } });
  const p = await ctx.newPage();
  if (three) await p.route("**/three.min.js", (r) => r.fulfill({ path: three, contentType: "application/javascript" }));
  await p.route("**/fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await p.addInitScript(() => {
    localStorage.setItem("mosfet-ch", "pn");
    localStorage.setItem("mosfet-pred", JSON.stringify({ pn: { skip: true } }));
  });
  // 時刻合わせ: 切り抜かない左上の隅の印を、出来事ごとに白黒反転する(build.mjs が動画から反転したコマを探す)
  const ev = { order: [] };
  const mark = async (k) => { ev[k] = (Date.now() - t0) / 1000; ev.order.push(k); await p.evaluate(() => { const m = document.getElementById("syncmark"); m.dataset.on = m.dataset.on === "1" ? "0" : "1"; m.style.background = m.dataset.on === "1" ? "#fff" : "#000"; }); };
  await p.goto("file://" + path.resolve(page_html));
  // 動画用: 操作パネルなどを隠し、3D だけを画面いっぱいに
  await p.addStyleTag({ content: `.head,.rail,.dock,.ruler,.quiz,.stage2d,.sheet,.pop{display:none!important}
    body{overflow:hidden!important}.app{display:block!important;height:100%!important}
    .viewport{position:fixed!important;inset:0!important;height:100%!important;min-height:0!important}
    .lbl{font-size:17px!important}` });
  await p.evaluate(() => { const m = document.createElement("div"); m.id = "syncmark"; m.style.cssText = "position:fixed;left:0;top:0;width:24px;height:24px;background:#000;z-index:99"; document.body.appendChild(m); dispatchEvent(new Event("resize")); });
  await p.waitForTimeout(1500);
  // 切り抜く範囲: 空乏層(のラベル)を中心にした 9:16
  // 境目の位置 = 「p 型」と「n 型」のラベルの中点(くっつける前は「空乏層」のラベルが出ていないため)
  const cx = await p.evaluate(() => {
    const ls = [...document.querySelectorAll(".lbl")], c = (re) => { const r = ls.find((e) => re.test(e.textContent)).getBoundingClientRect(); return r.x + r.width / 2; };
    return (c(/^p 型/) + c(/^n 型/)) / 2;
  });
  const cw = Math.round(H * 9 / 16 / 2) * 2;
  ev.crop = { w: cw, h: H, x: Math.max(0, Math.min(W - cw, Math.round(cx - cw / 2))) };
  // 切り抜くと端で切れる「p 型」「n 型」のラベルは隠し、動画側で付け直す
  await p.evaluate(() => document.querySelectorAll(".lbl").forEach((e) => { if (/^[pn] 型/.test(e.textContent)) e.style.visibility = "hidden"; }));
  await mark("start");
  await p.waitForTimeout(5200);
  await mark("join");
  await p.evaluate(() => document.getElementById("c-pn-play").click());
  // 釣り合いまで待つ(描画が遅い環境でも時刻をきちんと記録する)
  await p.waitForFunction(() => /釣り合い/.test(document.getElementById("o-c-pn-t")?.textContent || ""), null, { timeout: 60000, polling: 100 });
  await mark("equilibrium");
  await p.waitForTimeout(3500);
  // 空乏層の中(やや p 側)と外(p 側の奥)に電子を置く
  const pt = await p.evaluate(() => {
    const ls = [...document.querySelectorAll(".lbl")].filter((e) => e.style.display !== "none");
    const top = ls.find((e) => e.textContent === "空乏層"), bot = ls.find((e) => /電場/.test(e.textContent)), pl = ls.find((e) => /p 型/.test(e.textContent));
    const r = (e) => e.getBoundingClientRect(), a = r(top), c = r(bot), q = r(pl);
    return { x: (a.x + a.width / 2 + c.x + c.width / 2) / 2, y: (a.y + c.y) / 2 + 10, px: q.x + q.width / 2 };
  });
  await mark("probe");
  await p.mouse.click(pt.px, pt.y);
  await p.waitForTimeout(400);
  await p.mouse.click(pt.x - 6, pt.y);
  await p.waitForTimeout(6500);
  await mark("end");
  await p.waitForTimeout(800); // 最後の印の反転を録画に残す
  const video = p.video();
  await ctx.close(); await b.close();
  fs.renameSync(await video.path(), path.join(outDir, "raw.webm"));
  fs.writeFileSync(path.join(outDir, "events.json"), JSON.stringify(ev, null, 2));
  console.log("recorded", ev);
})();
