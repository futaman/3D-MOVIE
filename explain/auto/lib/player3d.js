/* 3D の場面用の決定的なプレイヤー。window.renderAt(t) で時刻 t のコマを描く。
   その回の visuals3d.js が window.WORLD = { init(g), update(sceneId, p, t, dur) } を定義する。
   画面の文字は、白い字幕 1 行(ナレーションを句読点で区切って順に出す)と、場面の中のラベルだけ。 */
(() => {
  "use strict";
  const EP = window.__EP, TM = window.__TIMING, T = THREE, W = 540, H = 960, S = 2;
  const FONT = '"Noto Sans JP","Yu Gothic","Meiryo","IPAGothic",sans-serif';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const qa = []; window.__QA = qa;
  const renderer = new T.WebGLRenderer({ canvas: document.getElementById("gl"), antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(S); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const ov = document.getElementById("ov"); ov.width = W * S; ov.height = H * S; const ctx = ov.getContext("2d");
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, W / H, 0.01, 2e5);
  let labels = [];
  const tmp = new T.Vector3();
  const g = {
    T, scene, camera, renderer, W, H, clamp,
    lerp: (a, b, t) => a + (b - a) * t,
    ease: (t) => { t = clamp(t); return t * t * (3 - 2 * t); },
    out: (t) => 1 - Math.pow(1 - clamp(t), 3),
    seg: (p, a, b) => clamp((p - a) / (b - a)),
    num: (v, d = 0) => v.toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d }),
    cam(pos, look, fov = 40) { camera.position.set(...pos); if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); } camera.lookAt(...look); },
    // 場面の中の点に付くラベル(世界座標)と、画面に固定のラベル
    label(text, pos, o = {}) { labels.push({ text, pos: pos.slice ? pos.slice() : [pos.x, pos.y, pos.z], o }); },
    screen(text, x, y, o = {}) { labels.push({ text, xy: [x, y], o }); },
  };
  window.G = g;
  const drawText = (str, x, y, o) => {
    ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.font = `${o.weight || 900} ${o.size || 24}px ${FONT}`; ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = o.strokeW || Math.max(5, (o.size || 24) * 0.24); ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.strokeText(str, x, y);
    ctx.fillStyle = o.color || "#fff"; ctx.fillText(str, x, y); const w = ctx.measureText(str).width; ctx.restore(); return w;
  };
  // 字幕: ナレーションを句読点で区切り、短いものは 15 字までつなぐ
  const chunksOf = (s) => { const parts = s.split(/(?<=[、。])/).filter(Boolean), out = []; for (const p of parts) { const last = out[out.length - 1]; if (last && (last + p).replace(/[、。]/g, "").length <= 15) out[out.length - 1] = last + p; else out.push(p); } return out; };
  const CH = Object.fromEntries(EP.scenes.map((s) => [s.id, chunksOf(s.narration)]));
  function subtitle(scene, lt, dur) {
    const cs = CH[scene.id], total = cs.reduce((a, c) => a + c.length, 0), speak = Math.max(0.1, dur - 0.3); let acc = 0, cur = cs[cs.length - 1];
    for (const c of cs) { acc += c.length; if (lt < speak * acc / total) { cur = c; break; } }
    const text = cur.replace(/[。]$/, "").replace(/、$/, "");
    let size = 31; ctx.font = `900 ${size}px ${FONT}`; while (ctx.measureText(text).width > W - 40 && size > 16) { size--; ctx.font = `900 ${size}px ${FONT}`; }
    if (size < 24) qa.push(`${scene.id}: 字幕「${text}」が長い(${size}px)`);
    drawText(text, W / 2, 668, { size, strokeW: 8 });
  }
  let inited = false;
  window.renderAt = (t) => {
    if (!inited) { try { window.WORLD.init(g); } catch (e) { qa.push("init でエラー: " + e.message); } inited = true; }
    const scs = TM.scenes; let i = scs.findIndex((s) => t < s.start + s.dur); if (i < 0) i = scs.length - 1;
    const tm = scs[i], sc = EP.scenes.find((s) => s.id === tm.id), lt = t - tm.start, p = clamp(lt / tm.dur);
    labels = [];
    try { window.WORLD.update(sc.id, p, lt, tm.dur); } catch (e) { qa.push(`${sc.id}: 絵でエラー ${e.message}`); }
    renderer.render(scene, camera);
    ctx.setTransform(S, 0, 0, S, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const l of labels) {
      let x, y;
      if (l.xy) [x, y] = l.xy; else { tmp.set(...l.pos).project(camera); if (tmp.z > 1 || tmp.z < -1) continue; x = (tmp.x + 1) / 2 * W + (l.o.dx || 0); y = (1 - tmp.y) / 2 * H + (l.o.dy || 0); }
      if (x < -50 || x > W + 50 || y < 0 || y > H) continue;
      const w = drawText(l.text, x, y, l.o);
      if (!l.o.loose && (x - w / 2 < 2 || x + w / 2 > W - 2)) qa.push(`${sc.id}: ラベル「${l.text}」が画面からはみ出す`);
      if (!l.o.loose && Math.abs(y - 668) < 34) qa.push(`${sc.id}: ラベル「${l.text}」が字幕に重なる`);
    }
    subtitle(sc, lt, tm.dur);
    return sc.id;
  };
  const s = document.createElement("script"); s.src = window.__VISUALS_URL;
  s.onload = () => { window.__READY = true; }; s.onerror = () => { qa.push("visuals3d.js を読み込めない"); window.__READY = true; };
  document.body.appendChild(s);
})();
