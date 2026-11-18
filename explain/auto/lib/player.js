/* 決定的な 2D プレイヤー。window.renderAt(t) で時刻 t [秒] のコマを描く(録画側が 1 コマずつ呼ぶ)。
   window.__EP = 台本、window.__TIMING = { scenes: [{ id, start, dur }], total }、window.__VISUALS_URL = その回の visuals.js */
(() => {
  "use strict";
  const EP = window.__EP, TM = window.__TIMING;
  const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
  const W = 540, H = 960, S = 2; cv.width = W * S; cv.height = H * S;
  const FONT = '"Noto Sans JP","Yu Gothic","Meiryo","IPAGothic",sans-serif';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const qa = []; window.__QA = qa;
  const g = {
    ctx, W, H, FONT, clamp,
    AREA: { x: 30, y: 150, w: 480, h: 560 },           // 絵を描いてよい範囲(上はタイトル帯、下は字幕)
    C: { bg: "#0b1220", fg: "#eef3f6", mute: "#8fa3b0", accent: "#ffd84a", blue: "#5fd0f5", red: "#ff6b57", green: "#8fe3a1", line: "#2a3a4a" },
    lerp: (a, b, t) => a + (b - a) * t,
    ease: (t) => { t = clamp(t); return t * t * (3 - 2 * t); },
    out: (t) => 1 - Math.pow(1 - clamp(t), 3),
    seg: (p, a, b) => clamp((p - a) / (b - a)),         // 場面の進み p のうち a〜b の区間を 0〜1 に
    text(str, x, y, o = {}) {
      ctx.save(); ctx.font = `${o.weight || 700} ${o.size || 24}px ${FONT}`; ctx.textAlign = o.align || "center"; ctx.textBaseline = o.base || "middle";
      ctx.globalAlpha *= o.alpha ?? 1;
      if (o.stroke) { ctx.lineJoin = "round"; ctx.lineWidth = o.strokeW || 6; ctx.strokeStyle = o.stroke; ctx.strokeText(str, x, y); }
      ctx.fillStyle = o.color || g.C.fg; ctx.fillText(str, x, y); const w = ctx.measureText(str).width; ctx.restore(); return w;
    },
    line(x1, y1, x2, y2, o = {}) { ctx.save(); ctx.strokeStyle = o.color || g.C.fg; ctx.lineWidth = o.w || 2; ctx.setLineDash(o.dash || []); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); },
    arrow(x1, y1, x2, y2, o = {}) { g.line(x1, y1, x2, y2, o); const a = Math.atan2(y2 - y1, x2 - x1), s = o.head || 9; ctx.save(); ctx.fillStyle = o.color || g.C.fg; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45)); ctx.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)); ctx.fill(); ctx.restore(); },
    rect(x, y, w, h, o = {}) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, o.r || 0); if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); } if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.w || 2; ctx.stroke(); } ctx.restore(); },
    circle(x, y, r, o = {}) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); } if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.w || 2; ctx.stroke(); } ctx.restore(); },
    num: (v, d = 0) => v.toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d }),
  };
  window.G = g;

  function chrome(scene) {
    // 上のタイトル帯
    g.rect(40, 44, W - 80, 64, { fill: "#ffffff", r: 10 });
    let size = 34; ctx.font = `900 ${size}px ${FONT}`;
    while (ctx.measureText(EP.title_band).width > W - 110 && size > 18) { size -= 1; ctx.font = `900 ${size}px ${FONT}`; }
    if (size < 24) qa.push(`タイトル帯が長すぎる(${size}px に縮小)`);
    g.text(EP.title_band, W / 2, 77, { size, weight: 900, color: "#111" });
    // 下の字幕(黄色・黒フチ、最大 2 行)
    const lines = String(scene.caption || "").split("\n");
    if (lines.length > 2) qa.push(`${scene.id}: 字幕が 3 行以上`);
    lines.forEach((ln, i) => {
      let s = 31; ctx.font = `900 ${s}px ${FONT}`;
      while (ctx.measureText(ln).width > W - 44 && s > 16) { s -= 1; ctx.font = `900 ${s}px ${FONT}`; }
      if (s < 24) qa.push(`${scene.id}: 字幕「${ln}」が長すぎる(${s}px に縮小)`);
      g.text(ln, W / 2, 770 + i * 46 - (lines.length - 1) * 23 + 23, { size: s, weight: 900, color: g.C.accent, stroke: "#000", strokeW: 8 });
    });
    g.text(EP.footer || "", W / 2, 925, { size: 12, weight: 400, color: g.C.mute });
  }

  window.renderAt = (t) => {
    const scs = TM.scenes; let i = scs.findIndex((s) => t < s.start + s.dur); if (i < 0) i = scs.length - 1;
    const tm = scs[i], scene = EP.scenes.find((s) => s.id === tm.id), lt = t - tm.start, p = clamp(lt / tm.dur);
    ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = g.C.bg; ctx.fillRect(0, 0, W, H);
    const fn = (window.VISUALS || {})[scene.id];
    ctx.save(); ctx.globalAlpha = clamp(lt / 0.2);
    try { if (fn) fn(g, p, lt, tm.dur, scene); else { qa.push(`${scene.id}: 絵の関数がない`); } } catch (e) { qa.push(`${scene.id}: 絵でエラー ${e.message}`); }
    ctx.restore(); ctx.globalAlpha = 1;
    chrome(scene);
    return scene.id;
  };
  const s = document.createElement("script"); s.src = window.__VISUALS_URL;
  s.onload = () => { window.__READY = true; }; s.onerror = () => { qa.push("visuals.js を読み込めない"); window.__READY = true; };
  document.body.appendChild(s);
})();
