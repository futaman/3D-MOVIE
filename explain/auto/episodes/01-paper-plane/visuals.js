/* 01 紙飛行機: 場面ごとの絵。fn(g, p, t, dur, scene)。p = 場面の進み 0〜1。描いてよい範囲は g.AREA */
(() => {
  const V = (window.VISUALS = {});
  const tower = (g, x, base, h) => {
    const c = g.ctx, w = h * 0.3; c.save(); c.strokeStyle = g.C.red; c.lineWidth = Math.max(1.5, h / 60); c.lineJoin = "round";
    c.beginPath(); c.moveTo(x - w / 2, base); c.quadraticCurveTo(x - w * 0.12, base - h * 0.45, x, base - h); c.quadraticCurveTo(x + w * 0.12, base - h * 0.45, x + w / 2, base); c.stroke();
    [0.25, 0.45, 0.62].forEach((f) => { const ww = w * (1 - f) * 0.62; c.strokeRect(x - ww / 2, base - h * f - 2, ww, 4); });
    c.restore();
  };
  const plane = (g, x, y, ang = 0, s = 1) => {
    const c = g.ctx; c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
    c.fillStyle = "#fff"; c.beginPath(); c.moveTo(16, 0); c.lineTo(-14, -9); c.lineTo(-8, 0); c.lineTo(-14, 9); c.closePath(); c.fill();
    c.fillStyle = "#b9c7d0"; c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, 0); c.lineTo(-14, 9); c.closePath(); c.fill(); c.restore();
  };
  const ground = (g, y) => g.line(30, y, 510, y, { color: g.C.mute, w: 2 });
  const ROWS = [["東京タワー", "333 m", 2], ["富士山頂", "3,776 m", 23], ["旅客機", "10,000 m", 60], ["成層圏", "37 km", 222]];
  const ladder = (g, n, pNew, hideLast) => {
    g.text("投げる高さ  →  飛距離", 270, 190, { size: 20, color: g.C.mute });
    ROWS.slice(0, n).forEach(([name, h, km], i) => {
      const y = 260 + i * 100, isNew = i === n - 1, a = isNew ? g.out(pNew / 0.35) : 1, c = g.ctx;
      c.save(); c.globalAlpha *= a;
      g.text(name, 40, y, { size: 22, align: "left" }); g.text(h, 40, y + 28, { size: 17, align: "left", color: g.C.mute, weight: 400 });
      const full = Math.max(4, km / 222 * 250), w = isNew ? full * g.out(g.seg(pNew, 0.2, 0.8)) : full;
      if (!(isNew && hideLast)) { g.rect(180, y - 2, w, 22, { fill: i === 3 ? g.C.accent : g.C.blue, r: 4 }); g.text(`${km} km`, 190 + w, y + 9, { size: 22, align: "left", color: i === 3 ? g.C.accent : g.C.fg }); }
      else g.text("? km", 190, y + 9, { size: 26, align: "left", color: g.C.accent });
      c.restore();
    });
  };

  V.s1 = (g, p, t) => { ground(g, 660); tower(g, 270, 660, 400); plane(g, 300 + Math.sin(t * 2) * 6, 236 + Math.cos(t * 2.4) * 4, -0.15); g.text("?", 380, 230 + Math.sin(t * 3) * 5, { size: 64, color: g.C.accent, alpha: g.seg(p, 0.3, 0.5) }); };
  V.s2 = (g, p) => {
    ground(g, 660); tower(g, 120, 660, 380);
    const a = g.seg(p, 0.05, 0.3); g.ctx.save(); g.ctx.globalAlpha *= a; g.arrow(60, 655, 60, 285, { color: g.C.fg }); g.arrow(60, 285, 60, 655, { color: g.C.fg }); g.text("333 m", 66, 250, { size: 24, align: "left" }); g.ctx.restore();
    const b = g.seg(p, 0.45, 0.8); g.ctx.save(); g.ctx.globalAlpha *= b;
    const x0 = 210, y0 = 330, dx = 270, dy = 45;
    g.line(x0, y0, x0 + dx, y0 + dy, { color: g.C.blue, w: 3 }); g.line(x0, y0, x0, y0 + dy, { color: g.C.mute, dash: [5, 4] }); g.line(x0, y0 + dy, x0 + dx, y0 + dy, { color: g.C.mute, dash: [5, 4] });
    g.text("1 m", x0 - 8, y0 + dy / 2, { size: 20, align: "right" }); g.text("6 m", x0 + dx / 2, y0 + dy + 22, { size: 20 }); plane(g, x0 + dx * g.ease(b), y0 + dy * g.ease(b), 0.17, 0.9);
    g.text("滑空比 6(仮定)", x0 + dx / 2, y0 - 34, { size: 20, color: g.C.blue }); g.ctx.restore();
  };
  V.s3 = (g, p) => {
    const X = (km) => 60 + km / 2.3 * 430, base = 620; ground(g, base); tower(g, X(0), base, 300);
    const f = g.ease(g.seg(p, 0.1, 0.75)), km = 2 * f, y = base - 300 * (1 - f);
    g.line(X(0), base - 300, X(km), y, { color: g.C.blue, w: 3, dash: [6, 5] }); plane(g, X(km), y, 0.58, 0.9);
    g.rect(X(1.5) - 9, base - 110, 18, 110, { fill: "#51616e" }); g.text("六本木ヒルズ", X(1.5), base + 22, { size: 16, color: g.C.mute }); g.text("1.5 km", X(1.5), base + 42, { size: 15, color: g.C.mute, weight: 400 });
    g.text(`${g.num(km, 1)} km`, 270, 230, { size: 56, color: g.C.accent });
    if (f >= 1) g.circle(X(2), base, 10 + 8 * g.seg(p, 0.75, 1), { stroke: g.C.accent, w: 3 });
    g.text("(高さは横より大きく描いています)", 270, 690, { size: 13, color: g.C.mute, weight: 400 });
  };
  V.s4 = (g, p) => { const k = g.ease(p); ground(g, 660); tower(g, 270, 660, 400 - 300 * k); g.arrow(270, 240 + 160 * (1 - k), 270, 190, { color: g.C.accent, w: 6, head: 18 }); plane(g, 270, 215 + 160 * (1 - k) - 40, -1.2, 1.2); g.text("もっと高く", 270, 695, { size: 40, color: g.C.accent, alpha: g.seg(p, 0.2, 0.5) }); };
  V.s5 = (g, p) => ladder(g, 2, p);
  V.s6 = (g, p) => ladder(g, 3, p);
  V.s7 = (g, p) => ladder(g, 4, p, true);
  V.s8 = (g, p) => {
    const X = (km) => 50 + km / 222 * 440, base = 620, top = 250, f = g.ease(g.seg(p, 0.05, 0.95)), km = 222 * f, y = top + (base - top) * f;
    ground(g, base); g.line(X(0), top, X(0), base, { color: g.C.mute, dash: [4, 4] }); g.text("高度 37 km", X(0) + 6, top - 16, { size: 17, align: "left", color: g.C.mute });
    tower(g, X(0), base, 26); g.text("東京タワー", X(0), base + 20, { size: 15, color: g.C.mute });
    const c = g.ctx; c.save(); c.fillStyle = "#3d4f5e"; c.beginPath(); c.moveTo(X(100) - 34, base); c.lineTo(X(100), base - 44); c.lineTo(X(100) + 34, base); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(X(100) - 9, base - 32); c.lineTo(X(100), base - 44); c.lineTo(X(100) + 9, base - 32); c.fill(); c.restore();
    g.text("富士山", X(100), base + 20, { size: 15, color: g.C.mute }); g.text("(経路は南へ約 12 km)", X(100), base + 40, { size: 12, color: g.C.mute, weight: 400 });
    g.rect(X(222) - 26, base - 5, 52, 8, { fill: g.C.blue, r: 4 }); g.text("?", X(222), base + 22, { size: 20, color: g.C.accent });
    g.line(X(0), top, X(km), y, { color: g.C.blue, w: 3, dash: [6, 5] }); plane(g, X(km), y, 0.7, 0.9);
    g.text(`${g.num(km)} km`, 300, 200, { size: 52, color: g.C.accent });
    g.text("(高さは横より大きく描いています)", 270, 690, { size: 13, color: g.C.mute, weight: 400 });
  };
  const lake = (g, cx, cy, s) => {
    const c = g.ctx; c.save(); c.translate(cx, cy); c.scale(s, s); c.fillStyle = "#1f6f8f"; c.beginPath();
    c.moveTo(-120, -20); c.bezierCurveTo(-130, -90, -40, -120, -10, -70); c.bezierCurveTo(20, -130, 110, -110, 120, -40); c.bezierCurveTo(140, 10, 90, 40, 60, 50); c.bezierCurveTo(50, 90, 20, 110, 6, 120); c.lineTo(-10, 120); c.bezierCurveTo(-20, 80, -60, 70, -90, 50); c.bezierCurveTo(-130, 40, -125, 0, -120, -20); c.fill();
    c.fillStyle = "#16506a"; c.fillRect(-140, 120, 280, 40); c.restore();
    g.text("太平洋(遠州灘)", cx, cy + 142 * s, { size: 14, color: g.C.mute, weight: 400 });
  };
  V.s9 = (g, p, t) => {
    lake(g, 270, 400, 1.35); const f = g.out(g.seg(p, 0, 0.55)), a = (1 - f) * 7;
    const x = 270 + Math.cos(a) * 170 * (1 - f), y = 380 + Math.sin(a) * 110 * (1 - f) - 120 * (1 - f);
    if (f < 1) plane(g, x, y, a + 1.9, 1.6 - 0.8 * f); else { plane(g, 270, 380, 0.3, 0.8); [0, 1, 2].forEach((i) => { const r = ((t * 0.6 + i / 3) % 1); g.circle(270, 380, 14 + r * 60, { stroke: `rgba(255,255,255,${0.7 * (1 - r)})`, w: 2 }); }); }
    g.text("浜名湖", 270, 215, { size: 58, color: g.C.fg, alpha: g.seg(p, 0.5, 0.7) });
  };
  V.s10 = (g, p) => {
    lake(g, 270, 330, 0.8); g.rect(50, 470, 440, 200, { fill: "#132131", stroke: g.C.line, r: 14 });
    g.text("浜名湖(静岡県)", 270, 505, { size: 28 });
    [["海とつながった湖(汽水湖)", 0.2], ["うなぎの養殖で知られる", 0.5]].forEach(([s, a], i) => { g.text("・" + s, 80, 560 + i * 46, { size: 22, align: "left", weight: 500, alpha: g.seg(p, a, a + 0.15) }); });
  };
  V.s11 = (g, p) => {
    g.rect(50, 190, 440, 150, { fill: "#132131", stroke: g.C.line, r: 14 });
    g.text("高度 37 km から", 270, 235, { size: 26, color: g.C.mute }); const w = g.text("紙飛行機で 222 km", 270, 285, { size: 30, color: g.C.mute });
    g.line(270 - w / 2 - 6, 285, 270 + (w / 2 + 6) * (2 * g.seg(p, 0.1, 0.3) - 1), 285, { color: g.C.red, w: 4 });
    const y = 480, x0 = 90, x1 = 450; g.line(x0, y, x1, y, { color: g.C.mute, w: 3 }); g.circle(x0, y, 8, { fill: g.C.fg }); g.circle(x1, y, 8, { fill: g.C.fg });
    g.text("東京", x0, y + 30, { size: 22 }); g.text("浜松", x1, y + 30, { size: 22 });
    const f = g.ease(g.seg(p, 0.3, 0.9)), tx = x0 + (x1 - x0) * f; g.rect(tx - 44, y - 34, 88, 24, { fill: "#f4f6f8", r: 10 }); g.rect(tx - 44, y - 22, 88, 5, { fill: "#2a5db0" });
    g.text("新幹線で 約 1 時間半", 270, 590, { size: 36, color: g.C.accent, alpha: g.seg(p, 0.45, 0.65) });
  };
})();
