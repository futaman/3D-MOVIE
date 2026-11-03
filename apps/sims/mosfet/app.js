/* 枠: 章の登録・切り替え、パネルと計器、カメラ、ポインタ操作、毎フレームの描画。 */
(() => {
  "use strict";
  const K = MOSKit, P = MOSPhys, T = THREE;
  const ORDER = ["switch", "peek", "atom", "dope", "pn", "channel", "flow", "body", "quiz"];
  const PARTS = { A: "入口", B: "材料", C: "接合", D: "MOS", E: "確認" };
  const NUM = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
  const defs = ORDER.map((id) => MOS.chapters[id]).filter(Boolean);
  defs.forEach((d, i) => { d.n = NUM[i]; d.index = i; });
  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Three.js ---------- */
  const canvas = $("gl"), viewport = $("viewport");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 500);
  scene.add(new T.HemisphereLight(0xcfe6ff, 0x1a1410, 0.75));
  const key = new T.DirectionalLight(0xffffff, 0.85); key.position.set(4, 9, 6); scene.add(key);
  const rim = new T.DirectionalLight(0x6fd6ff, 0.35); rim.position.set(-6, 3, -5); scene.add(rim);

  /* ---------- 共有の文脈 ---------- */
  const labelsEl = $("labels");
  const drag = { yaw: 0, pitch: 0, ty: 0, tp: 0, down: false };
  const ctx = {
    T, K, P, scene, camera, renderer, viewport, reduced, drag, $, t: 0,
    S: {}, done: {},
    cur: () => defs[cur],
    // 3D 上のラベル。ids: 表示する章の id の配列
    labels: [],
    label(text, pos, ids, cls = "") {
      const el = document.createElement("div"); el.className = "lbl " + cls; el.innerHTML = text; labelsEl.appendChild(el);
      const l = { el, pos, ids, hidden: false, set(t) { el.innerHTML = t; } };
      ctx.labels.push(l); return l;
    },
    refresh: () => update(),
  };
  defs.forEach((d) => { ctx.S[d.id] = Object.assign({}, d.state || {}); });

  function groupOf(d) {
    if (d._group === undefined) {
      d._group = d.build ? d.build(ctx) : null;
      if (d._group && !d._group.parent) scene.add(d._group);
    }
    return d._group;
  }

  /* ---------- 章のレール ---------- */
  const rail = $("rail");
  let lastPart = null;
  defs.forEach((d, i) => {
    if (d.part !== lastPart) {
      const h = document.createElement("div"); h.className = "part"; h.textContent = PARTS[d.part] || ""; rail.appendChild(h);
      lastPart = d.part;
    }
    const b = document.createElement("button");
    b.innerHTML = `<span class="dot"></span><span class="name">${d.n} · ${d.title}</span>`;
    b.setAttribute("aria-label", `${d.n} ${d.title}`);
    b.dataset.i = i;
    b.addEventListener("click", () => go(i));
    rail.appendChild(b);
  });
  const railButtons = [...rail.querySelectorAll("button")];

  /* ---------- パネル(やってみよう / 計器) ---------- */
  const taskBody = $("taskBody"), meters = $("meters"), quizEl = $("quiz"), app = $("app");

  function ctrlId(d, c) { return `c-${d.id}-${c.id}`; }
  function renderPanel(d) {
    const S = ctx.S[d.id];
    app.classList.toggle("overlay", !!d.overlay);
    if (d.overlay) { taskBody.innerHTML = ""; meters.innerHTML = ""; d.renderOverlay(ctx, quizEl); return; }
    quizEl.innerHTML = "";
    let h = `<p class="prompt">${K.sub(d.prompt)}</p><p class="explain" id="explain"></p>`;
    for (const c of d.controls || []) {
      if (c.type === "range") {
        h += `<div class="ctrl"><label for="${ctrlId(d, c)}"><span>${K.sub(c.label)}</span><output id="o-${ctrlId(d, c)}"></output></label>
          <input type="range" id="${ctrlId(d, c)}" min="${c.min}" max="${c.max}" step="${c.step}" value="${S[c.id]}"></div>`;
      } else if (c.type === "seg") {
        h += `<div class="ctrl"><span class="ctrl-label">${K.sub(c.label)}</span><div class="seg" role="group" aria-label="${c.label}" id="${ctrlId(d, c)}">
          ${c.options.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(S[c.id]) === String(v)}">${l}</button>`).join("")}</div></div>`;
      } else if (c.type === "buttons") {
        h += `<div class="btns">${c.items.map((it) => `<button type="button" class="btn" id="${ctrlId(d, { id: it.id })}" data-b="${it.id}">${it.label}</button>`).join("")}</div>`;
      }
    }
    if (d.note) h += `<p class="note">${K.sub(d.note)}</p>`;
    taskBody.innerHTML = h;

    for (const c of d.controls || []) {
      const el = $(ctrlId(d, c));
      if (c.type === "range") {
        const out = $("o-" + ctrlId(d, c));
        const f = (user) => { S[c.id] = parseFloat(el.value); out.innerHTML = K.sub(c.fmt(S[c.id])); if (user && d.onInput) d.onInput(ctx, c.id); update(); };
        el.addEventListener("input", () => f(true)); out.innerHTML = K.sub(c.fmt(S[c.id]));
      } else if (c.type === "seg") {
        el.addEventListener("click", (e) => {
          const b = e.target.closest("button"); if (!b) return;
          const v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
          S[c.id] = v;
          el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          if (d.onInput) d.onInput(ctx, c.id);
          update();
        });
      } else if (c.type === "buttons") {
        taskBody.querySelectorAll("[data-b]").forEach((b) => b.addEventListener("click", () => { d.onButton(ctx, b.dataset.b); update(); }));
      }
    }

    let m = (d.meters || []).map((x) => `<div class="meter card"><span class="k">${K.sub(x.k)}</span><span class="v" id="m-${x.id}"></span><span class="c" id="mc-${x.id}"></span></div>`).join("");
    if (d.graph) m += `<div class="graph card ${d.graph.tall ? "tall" : ""}"><span class="gk">${K.sub(d.graph.label)}</span><canvas id="graph" aria-label="${d.graph.aria}"></canvas></div>`;
    if (d.legend) m += `<div class="meter card"><div class="legend">${d.legend.map((k) => LEGEND[k]).join("")}</div></div>`;
    meters.innerHTML = m;
  }
  const LEGEND = {
    e: `<span><i style="background:var(--electron)"></i>電子</span>`,
    h: `<span><i class="ring" style="border-color:var(--hole)"></i>正孔</span>`,
    neg: `<span><b style="color:var(--ion)">−</b>動けない負イオン</span>`,
    pos: `<span><b style="color:var(--gate)">＋</b>動けない正イオン</span>`,
    field: `<span><b style="color:var(--fg)">→</b>電場</span>`,
  };

  /* ---------- 更新 ---------- */
  let cur = 0;
  function fmtMag(m) {
    if (!m) return "";
    if (m < 1000) return `約 ×${Math.round(m)}`;
    const e = Math.floor(Math.log10(m)), a = Math.round(m / 10 ** e);
    const sup = (n) => String(n).split("").map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c]).join("");
    return a === 1 ? `約 ×10${sup(e)}` : `約 ×${a}×10${sup(e)}`;
  }
  function update() {
    const d = defs[cur], S = ctx.S[d.id];
    $("numeral").textContent = d.n; $("chTitle").textContent = d.title;
    $("prev").disabled = cur === 0; $("next").disabled = cur === defs.length - 1;
    const r = d.update ? d.update(ctx, S) || {} : {};
    if (r.explain !== undefined && $("explain")) $("explain").innerHTML = K.sub(r.explain);
    for (const [id, [v, c]] of Object.entries(r.m || {})) {
      const ev = $("m-" + id), ec = $("mc-" + id);
      if (ev && v !== undefined) ev.innerHTML = K.sub(v);
      if (ec && c !== undefined) ec.innerHTML = K.sub(c);
    }
    if (r.met) ctx.done[d.id] = true;
    const g = $("goal");
    g.hidden = !r.goal;
    g.innerHTML = K.sub(ctx.done[d.id] ? `✓ ${r.goal}` : `目標: ${r.goal}`);
    g.classList.toggle("met", !!ctx.done[d.id]);
    railButtons.forEach((b, i) => {
      if (i === cur) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      b.classList.toggle("done", !!ctx.done[defs[i].id]);
    });
    const mag = r.mag !== undefined ? r.mag : d.mag;
    $("scaleChip").textContent = [fmtMag(mag), r.scale || d.scale].filter(Boolean).join(" · ");
    drawRuler(mag);
    if (d.draw && $("graph")) d.draw(ctx, $("graph"), S);
  }

  function drawRuler(mag) {
    const svg = $("ruler"), top = 14, bot = 386, h = bot - top, E = 10;
    const muted = K.css("--muted"), fg = K.css("--fg"), acc = K.css("--electron");
    const sup = (n) => String(n).split("").map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c]).join("");
    let s = `<line x1="40" y1="${top}" x2="40" y2="${bot}" stroke="${muted}" stroke-opacity=".5"/>`;
    for (let e = 0; e <= E; e++) {
      const y = bot - h * e / E;
      s += `<line x1="34" y1="${y}" x2="46" y2="${y}" stroke="${muted}"/>`;
      s += `<text x="30" y="${y + 4}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="10" fill="${muted}">${e === 0 ? "×1" : e === 1 ? "×10" : "×10" + sup(e)}</text>`;
    }
    const marks = [[0, "机"], [3, "チップ"], [5, "セル"], [8, "結晶"], [9, "原子"]];
    for (const [e, t] of marks) s += `<text x="52" y="${bot - h * e / E + 4}" font-size="9" fill="${muted}" fill-opacity=".7">${t}</text>`;
    if (mag) {
      const y = bot - h * Math.min(E, Math.log10(mag)) / E;
      s += `<path d="M46 ${y} l-9 -5 v10 z" fill="${acc}"/><line x1="30" y1="${y}" x2="46" y2="${y}" stroke="${fg}" stroke-width="2"/>`;
    }
    svg.innerHTML = s;
  }

  /* ---------- 章の切り替え ---------- */
  let fading = false;
  function go(i) {
    if (i < 0 || i >= defs.length || i === cur || fading) return;
    if (reduced) { setCh(i); return; }
    fading = true; $("fade").classList.add("on");
    setTimeout(() => { setCh(i); $("fade").classList.remove("on"); fading = false; }, 280);
  }
  function setCh(i) {
    cur = i; drag.ty = drag.tp = drag.yaw = drag.pitch = 0;
    const d = defs[i];
    groupOf(d);
    try { localStorage.setItem("mosfet-ch", d.id); } catch (e) {}
    renderPanel(d);
    if (d.onEnter) d.onEnter(ctx, ctx.S[d.id]);
    update();
  }
  $("prev").addEventListener("click", () => go(cur - 1));
  $("next").addEventListener("click", () => go(cur + 1));
  addEventListener("keydown", (e) => {
    if (["INPUT", "BUTTON"].includes(e.target.tagName) && e.target.type !== "button") return;
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") go(cur + 1);
    if (e.key === "ArrowLeft") go(cur - 1);
  });

  /* ---------- ポインタ: 小さな動きはクリック、大きな動きはドラッグ ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, moved: false };
  function rayAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); return ray;
  }
  canvas.addEventListener("pointerdown", (e) => {
    drag.down = true; ptr.x = ptr.sx = e.clientX; ptr.y = ptr.sy = e.clientY; ptr.moved = false;
    canvas.setPointerCapture(e.pointerId);
    const d = defs[cur]; if (d.onDrag) d.onDrag(ctx, rayAt(e), "start");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag.down) return;
    if (Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 6) ptr.moved = true;
    const d = defs[cur];
    if (d.onDrag) { if (ptr.moved) { d.onDrag(ctx, rayAt(e), "move"); update(); } }
    else if (d.orbit !== false) {
      drag.ty = K.clamp(drag.ty + (e.clientX - ptr.x) * 0.005, -0.6, 0.6);
      drag.tp = K.clamp(drag.tp + (e.clientY - ptr.y) * 0.003, -0.25, 0.35);
    }
    ptr.x = e.clientX; ptr.y = e.clientY;
  });
  const up = (e) => {
    if (!drag.down) return; drag.down = false;
    const d = defs[cur];
    if (!ptr.moved && d.onClick) { d.onClick(ctx, rayAt(e)); update(); }
    if (d.onDrag) d.onDrag(ctx, rayAt(e), "end");
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", () => { drag.down = false; });

  function resize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const d = defs[cur]; if (d && d.draw && $("graph")) d.draw(ctx, $("graph"), ctx.S[d.id]);
  }
  new ResizeObserver(resize).observe(viewport);

  /* ---------- 毎フレーム ---------- */
  const clock = new T.Clock(), tmp = new T.Vector3();
  let liveTimer = 0;
  function orbitCamera(view) {
    const off = view.pos.clone().sub(view.look);
    const sway = reduced || drag.down ? 0 : Math.sin(ctx.t * 0.25) * 0.05;
    const r = off.length() * (camera.aspect < 1 ? 1.15 / Math.max(0.55, camera.aspect) : 1);
    const yaw = Math.atan2(off.x, off.z) + drag.yaw + sway, el = Math.asin(off.y / off.length()) + drag.pitch;
    camera.position.set(view.look.x + r * Math.cos(el) * Math.sin(yaw), view.look.y + r * Math.sin(el), view.look.z + r * Math.cos(el) * Math.cos(yaw));
    if (camera.near !== 0.1) { camera.near = 0.1; camera.updateProjectionMatrix(); }
    camera.lookAt(view.look);
  }
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05); ctx.t += reduced ? 0 : dt;
    const d = defs[cur], g = groupOf(d), S = ctx.S[d.id];
    defs.forEach((x) => { if (x._group) x._group.visible = false; });
    if (g) g.visible = true;
    drag.yaw += (drag.ty - drag.yaw) * 0.12; drag.pitch += (drag.tp - drag.pitch) * 0.12;
    if (d.camera) d.camera(ctx, S); else if (d.view) orbitCamera(d.view);
    if (d.frame) d.frame(ctx, dt, S);
    liveTimer += dt;
    if (d.live && liveTimer > 0.25) { liveTimer = 0; update(); }

    const w = viewport.clientWidth, h = viewport.clientHeight;
    for (const l of ctx.labels) {
      const on = l.ids.includes(d.id) && !l.hidden;
      if (!on) { if (l.el.style.display !== "none") l.el.style.display = "none"; continue; }
      tmp.copy(l.pos).project(camera);
      l.el.style.display = tmp.z > 1 || tmp.z < -1 ? "none" : "";
      l.el.style.left = ((tmp.x + 1) / 2 * w) + "px"; l.el.style.top = ((1 - tmp.y) / 2 * h) + "px";
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  let start = 0;
  try { const s = localStorage.getItem("mosfet-ch"); const i = defs.findIndex((d) => d.id === s); if (i >= 0) start = i; } catch (e) {}
  resize(); setCh(start);
  requestAnimationFrame(frame);
})();
