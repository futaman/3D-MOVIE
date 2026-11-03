/* C 接合: PN 接合と電場 */
(() => {
  "use strict";
  const K = MOSKit, P = MOSPhys, T = THREE, V = K.V, C = K.C;
  const UPM = 4;                       // 3D の 1 µm = 4 単位(x = ±6 が ±1.5 µm)
  const XL = 6, YH = 1.7, ZH = 1.1, MAXN = 480;
  const sup = (n) => String(n).split("").map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c] || "⁻").join("");
  const sci = (v) => { const e = Math.floor(Math.log10(v)); return `${(v / 10 ** e).toFixed(2)}×10${sup(e)}`; };

  const J = { rnd: K.rng(5), ionsP: [], ionsN: [], holes: [], elecs: [], tests: [], model: null };
  const M = {};

  function regen(S) {
    const NA = 10 ** S.ea, ND = 10 ** S.ed;
    const nA = Math.round(150 * NA / 1e16), nD = Math.round(150 * ND / 1e16), r = J.rnd;
    J.ionsP = []; J.ionsN = []; J.holes = []; J.elecs = [];
    for (let i = 0; i < nA; i++) {
      const x = -0.08 - r() * (XL - 0.16), y = (r() * 2 - 1) * YH, z = (r() * 2 - 1) * ZH;
      J.ionsP.push({ x, y, z });
      J.holes.push({ bx: K.clamp(x + (r() - 0.5) * 0.5, -XL + 0.1, -0.05), y: K.clamp(y + (r() - 0.5) * 0.5, -YH, YH), z, p: r() * 6.28 });
    }
    for (let i = 0; i < nD; i++) {
      const x = 0.08 + r() * (XL - 0.16), y = (r() * 2 - 1) * YH, z = (r() * 2 - 1) * ZH;
      J.ionsN.push({ x, y, z });
      J.elecs.push({ bx: K.clamp(x + (r() - 0.5) * 0.5, 0.05, XL - 0.1), y: K.clamp(y + (r() - 0.5) * 0.5, -YH, YH), z, p: r() * 6.28 });
    }
    J.model = P.pn(NA, ND);
  }
  const prog = (S) => K.smooth(0.15, 0.85, S.t);            // 空乏層ができていく進み具合
  const gap = (S) => 0.6 * (1 - K.smooth(0, 0.15, S.t));     // くっつける前のすき間
  const edges3 = () => ({ xp: J.model.xp * 1e4 * UPM, xn: J.model.xn * 1e4 * UPM });
  function E3(x3) { return P.pnAt(J.model, x3 / UPM * 1e-4).E; } // [V/cm]

  MOS.chapters.pn = {
    id: "pn", part: "C", title: "PN 接合と電場", mag: 7e4, scale: "接合の断面",
    state: { t: 0, playing: false, ea: 16, ed: 16, place: "e", placed: false },
    prompt: "「くっつける」を押して、境目で何が起きるか見よう。釣り合ったら、空乏層の中に試し電荷を置いてみよう。",
    controls: [
      { type: "buttons", items: [{ id: "play", label: "くっつける(再生)" }, { id: "clear", label: "試し電荷を消す" }] },
      { type: "range", id: "t", label: "時間", min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.05 ? "くっつける前" : v < 0.9 ? "途中" : "釣り合い") },
      { type: "seg", id: "place", label: "タップで置く試し電荷", options: [["e", "電子"], ["h", "正孔"]] },
      { type: "range", id: "ea", label: "p 側の不純物の濃さ N_A", min: 15.5, max: 16.5, step: 0.05, fmt: (v) => `${sci(10 ** v)} cm⁻³` },
      { type: "range", id: "ed", label: "n 側の不純物の濃さ N_D", min: 15.5, max: 16.5, step: 0.05, fmt: (v) => `${sci(10 ** v)} cm⁻³` },
    ],
    note: "粒の数は見やすさのために減らしています(実際は 1 µm³ に 10⁴ 個ほど)。p 側と n 側の濃さの比は保っています。数値とグラフは 1 次元・階段接合・空乏近似のモデル(300 K)。空乏層の中にもキャリアはごくわずかにいますが、ゼロとみなしています。",
    meters: [
      { id: "vbi", k: "内蔵電位 V_bi" },
      { id: "w", k: "空乏層の幅 W" },
      { id: "emax", k: "最大電場 E_max" },
      { id: "bal", k: "取り残されたイオン" },
    ],
    graph: { label: "電荷 → 電場 → 電位", aria: "接合のまわりの電荷・電場・電位のグラフ", tall: true },
    legend: ["e", "h", "pos", "neg", "field"],
    view: { pos: V(0, 1.2, 15.5), look: V(0, -2.3, 0) },
    live: true,
    build(ctx) {
      const g = new T.Group(), ids = ["pn"], S = ctx.S.pn;
      regen(S);
      M.pBlock = new T.Group(); M.nBlock = new T.Group(); g.add(M.pBlock, M.nBlock);
      const pb = new T.Mesh(new T.BoxGeometry(XL, YH * 2 + 0.2, ZH * 2 + 0.2), K.glass("#7a3f3a", 0.13)); pb.position.x = -XL / 2; pb.renderOrder = 3;
      const nb = new T.Mesh(new T.BoxGeometry(XL, YH * 2 + 0.2, ZH * 2 + 0.2), K.glass("#2b6f85", 0.13)); nb.position.x = XL / 2; nb.renderOrder = 3;
      M.pBlock.add(pb, K.edges(pb, "#c47a70", 0.5)); M.nBlock.add(nb, K.edges(nb, "#5fc4dc", 0.5));
      M.dep = new T.Mesh(new T.BoxGeometry(1, YH * 2 + 0.24, ZH * 2 + 0.24), K.glass("#eaf3f5", 0.07)); M.dep.renderOrder = 4; g.add(M.dep);
      M.depEdge = K.edges(M.dep, "#eaf3f5", 0.35); g.add(M.depEdge);
      M.neg = K.signs(MAXN, "#c6bcff", false, 0.2); M.pos = K.signs(MAXN, "#ffd27a", true, 0.2);
      M.h = K.inst(K.holeGeo(0.085), K.holeMat(), MAXN); M.e = K.inst(K.electronGeo(0.075), K.electronMat(), MAXN);
      M.pBlock.add(M.neg.group, M.h); M.nBlock.add(M.pos.group, M.e);
      M.field = K.fieldArrows(26 * 4 * 2); g.add(M.field.group);
      M.te = K.inst(K.electronGeo(0.14), new T.MeshStandardMaterial({ color: C("#bff6ff"), emissive: C("#5fe1f5"), emissiveIntensity: 1.2 }), 8);
      const thg = K.holeGeo(0.15); M.th = K.inst(thg, new T.MeshStandardMaterial({ color: C("#ffd0c4"), emissive: C("#ff8a75"), emissiveIntensity: 1.1 }), 8);
      g.add(M.te, M.th);
      ctx.label("p 型(ホウ素)", V(-3, YH + 0.55, 0), ids, "h");
      ctx.label("n 型(リン)", V(3, YH + 0.55, 0), ids, "e");
      M.depLabel = ctx.label("空乏層", V(0, YH + 0.55, 0), ids, "strong");
      M.fieldLabel = ctx.label("電場 ← n から p へ", V(0, -YH - 0.5, ZH), ids);
      return g;
    },
    onButton(ctx, b) {
      const S = ctx.S.pn;
      if (b === "play") { S.t = 0; S.playing = true; J.tests = []; }
      if (b === "clear") J.tests = [];
    },
    onInput(ctx, id) {
      const S = ctx.S.pn;
      if (id === "t") S.playing = false;
      if (id === "ea" || id === "ed") { regen(S); }
    },
    onClick(ctx, ray) {
      const S = ctx.S.pn, p = new T.Vector3();
      if (!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 0, 1), -(ZH + 0.1)), p)) return;
      if (Math.abs(p.x) > XL || Math.abs(p.y) > YH) return;
      if (J.tests.length >= 8) J.tests.shift();
      J.tests.push({ x: p.x, y: p.y, z: ZH * 0.7, type: S.place, p: J.rnd() * 6.28 });
      const inside = Math.abs(E3(p.x)) > 0.15 * J.model.Emax && S.t > 0.9;
      if (inside) S.placed = true;
    },
    update(ctx, S) {
      const m = J.model, s = prog(S), e = edges3();
      M.depLabel.hidden = s < 0.5; M.fieldLabel.hidden = s < 0.5;
      M.depLabel.pos.x = (e.xn - e.xp) / 2;
      let ex;
      if (S.t < 0.05) ex = "くっつける前。p 型(左)には正孔と動けない−イオン、n 型(右)には自由電子と動けない＋イオンが、同じ数ずつあります。どちらも中性で、電場はありません。";
      else if (S.t < 0.9) ex = "くっつけると、濃さの差で電子は p 側へ、正孔は n 側へ広がり(拡散)、出会って消えます。境目には動けないイオンだけが取り残され、そこだけ中性が崩れていきます。";
      else {
        ex = "取り残された＋イオン(n 側)と−イオン(p 側)の間に、電場(白い矢印、n → p 向き)が生まれました。この電場が電子を n 側へ、正孔を p 側へ押し戻し、拡散と釣り合ったところで空乏層の幅が決まります。空乏層の本質は「キャリアがいない」ことより、この電場があることです。";
        if (Math.abs(S.ea - S.ed) > 0.1) ex += " 濃さの薄い側に空乏層が深く広がり、両側のイオンの電荷の量はいつも等しくなります。";
        ex += S.placed ? " 空乏層の中に置いた試し電荷は電場で一気に運ばれ、外(中性の領域)ではほとんど押されません。" : " 空乏層の中と外に、試し電荷を置き比べてみよう。";
      }
      if (S.t >= 0.9 || S.playing) { /* 値は釣り合いの値を表示 */ }
      const done = true, eq = S.t >= 0.9 ? "" : "(釣り合ったときの値)";
      return {
        goal: "空乏層の中で試し電荷を動かす", met: S.placed, explain: ex,
        m: {
          vbi: [`${m.vbi.toFixed(2)}<small>V</small>`, "電位の段差" + eq],
          w: [`${(m.W * 1e4).toFixed(2)}<small>µm</small>`, `p 側 ${(m.xp * 1e4).toFixed(2)} · n 側 ${(m.xn * 1e4).toFixed(2)} µm`],
          emax: [`${(m.Emax / 1e4).toFixed(1)}<small>V/µm</small>`, "境目でいちばん強い" + eq],
          bal: [`<span style="font-size:15px">−${sci(m.NA * m.xp)} / +${sci(m.ND * m.xn)}</span>`, "p 側 / n 側 [個/cm²] いつも等しい"],
        },
      };
    },
    draw(ctx, cv, S) {
      const { ctx: c, W, H } = K.canvas2d(cv), m = J.model, s = prog(S);
      const muted = K.css("--muted"), line = K.css("--line"), fg = K.css("--fg"), elc = K.css("--electron"), hol = K.css("--hole"), ion = K.css("--ion"), gate = K.css("--gate");
      const L = 34, R = 8, T0 = 6, rowH = (H - T0 - 20) / 3, xmax = 1.5e-4;
      const X = (x) => L + (x + xmax) / (2 * xmax) * (W - L - R);
      const rows = [
        { name: "電荷 ρ", f: (x) => P.pnAt(m, x).rho / P.Q / 1e16, max: Math.max(m.NA, m.ND) / 1e16, sym: true, unit: "×10¹⁶q" },
        { name: "電場の強さ |E|", f: (x) => -P.pnAt(m, x).E / 1e4, max: m.Emax / 1e4, sym: false, unit: "V/µm" },
        { name: "電位 V", f: (x) => P.pnAt(m, x).V, max: m.vbi, sym: false, unit: "V" },
      ];
      rows.forEach((r, k) => {
        const top = T0 + k * rowH, h = rowH - 14, base = r.sym ? top + h / 2 : top + h;
        const Y = (v) => (r.sym ? base - v / r.max * h / 2 : base - v / r.max * h);
        c.strokeStyle = line; c.beginPath(); c.moveTo(L, base); c.lineTo(W - R, base); c.stroke();
        c.fillStyle = muted; c.textAlign = "left"; c.fillText(`${r.name}`, L + 2, top + 9);
        c.textAlign = "right"; c.fillText(r.unit, W - R, top + 9);
        c.fillText(k === 1 ? (r.max * s).toFixed(1) : k === 2 ? (r.max * s).toFixed(2) : `${r.max.toFixed(1)}`, L - 4, (r.sym ? top + 4 : top + 8) + 6);
        c.fillText("0", L - 4, base + 3);
        c.lineWidth = 2; c.beginPath();
        for (let i = 0; i <= 240; i++) {
          const x = -xmax + 2 * xmax * i / 240, v = r.f(x) * s;
          i ? c.lineTo(X(x), Y(v)) : c.moveTo(X(x), Y(v));
        }
        c.strokeStyle = k === 0 ? ion : k === 1 ? fg : gate; c.stroke(); c.lineWidth = 1;
        if (k === 0 && s > 0.02) {
          c.fillStyle = ion; c.globalAlpha = 0.25; c.fillRect(X(-m.xp), base, X(0) - X(-m.xp), (m.NA / 1e16) / r.max * h / 2 * s); c.globalAlpha = 1;
          c.fillStyle = gate; c.globalAlpha = 0.25; c.fillRect(X(0), base - (m.ND / 1e16) / r.max * h / 2 * s, X(m.xn) - X(0), (m.ND / 1e16) / r.max * h / 2 * s); c.globalAlpha = 1;
        }
      });
      if (s > 0.02) {
        c.setLineDash([3, 3]); c.strokeStyle = muted; c.globalAlpha = 0.6;
        [-m.xp, m.xn].forEach((x) => { c.beginPath(); c.moveTo(X(x), T0); c.lineTo(X(x), H - 20); c.stroke(); });
        c.setLineDash([]); c.globalAlpha = 1;
      }
      c.fillStyle = muted; c.textAlign = "center";
      [-1, -0.5, 0, 0.5, 1].forEach((u) => c.fillText(u, X(u * 1e-4), H - 6));
      c.textAlign = "left"; c.fillStyle = hol; c.fillText("← p", L, H - 6); c.textAlign = "right"; c.fillStyle = elc; c.fillText("n → µm", W - R, H - 6);
    },
    frame(ctx, dt, S) {
      if (S.playing) {
        S.t = Math.min(1, S.t + dt / 4);
        const el = document.getElementById("c-pn-t"), out = document.getElementById("o-c-pn-t");
        if (el) { el.value = S.t; out.textContent = S.t < 0.05 ? "くっつける前" : S.t < 0.9 ? "途中" : "釣り合い"; }
        if (S.t >= 1) S.playing = false;
      }
      const s = prog(S), gp = gap(S), e = edges3(), t = ctx.t, jit = ctx.reduced ? 0 : 0.06;
      M.pBlock.position.x = -gp; M.nBlock.position.x = gp;
      J.ionsP.forEach((o, i) => M.neg.set(i, o.x, o.y, o.z)); for (let i = J.ionsP.length; i < MAXN; i++) M.neg.hide(i);
      J.ionsN.forEach((o, i) => M.pos.set(i, o.x, o.y, o.z)); for (let i = J.ionsN.length; i < MAXN; i++) M.pos.hide(i);
      M.neg.done(); M.pos.done();
      J.holes.forEach((h, i) => {
        let x = h.bx, sc = 1;
        if (-h.bx < e.xp) { const r = K.clamp((s - (-h.bx / e.xp) * 0.85) / 0.15, 0, 1); x = h.bx + (0.35 - h.bx) * r; sc = 1 - r; }
        if (sc < 0.02) K.hide(M.h, i); else K.put(M.h, i, x + Math.sin(t * 2.3 + h.p) * jit, h.y + Math.cos(t * 1.9 + h.p) * jit, h.z, sc);
      });
      for (let i = J.holes.length; i < MAXN; i++) K.hide(M.h, i);
      J.elecs.forEach((q, i) => {
        let x = q.bx, sc = 1;
        if (q.bx < e.xn) { const r = K.clamp((s - (q.bx / e.xn) * 0.85) / 0.15, 0, 1); x = q.bx + (-0.35 - q.bx) * r; sc = 1 - r; }
        if (sc < 0.02) K.hide(M.e, i); else K.put(M.e, i, x + Math.sin(t * 2.6 + q.p) * jit, q.y + Math.cos(t * 2.1 + q.p) * jit, q.z, sc);
      });
      for (let i = J.elecs.length; i < MAXN; i++) K.hide(M.e, i);
      M.h.instanceMatrix.needsUpdate = M.e.instanceMatrix.needsUpdate = true;
      // 空乏層の範囲
      const w = Math.max(0.001, (e.xp + e.xn) * s);
      M.dep.visible = M.depEdge.visible = s > 0.02;
      M.dep.scale.x = M.depEdge.scale.x = w; M.dep.position.x = M.depEdge.position.x = (e.xn - e.xp) / 2 * s;
      // 電場の矢印(n → p、−x 向き)
      let k = 0;
      for (let ix = 0; ix < 26; ix++) for (const y of [-1.25, -0.42, 0.42, 1.25]) for (const z of [-0.5, 0.6]) {
        const x = -XL + 0.24 + ix * 0.46, mag = Math.abs(E3(x)) / J.model.Emax * s;
        if (mag < 0.05) M.field.hide(k++); else M.field.set(k++, x, y, z, 0.25 + 0.6 * mag, -1);
      }
      M.field.done();
      // 試し電荷: 電場で運ばれる(電子は電場と逆向き = +x、正孔は −x)
      let ne = 0, nh = 0;
      for (const q of J.tests) {
        const Ex = E3(q.x) * s, dir = q.type === "e" ? -1 : 1;
        if (!ctx.reduced) q.x = K.clamp(q.x + dir * Math.sign(Ex) * Math.abs(Ex) / J.model.Emax * 3.2 * dt, -XL + 0.1, XL - 0.1);
        const jx = Math.sin(t * 3 + q.p) * jit, jy = Math.cos(t * 2.4 + q.p) * jit;
        if (q.type === "e") K.put(M.te, ne++, q.x + jx, q.y + jy, q.z); else K.put(M.th, nh++, q.x + jx, q.y + jy, q.z);
      }
      for (; ne < 8; ne++) K.hide(M.te, ne);
      for (; nh < 8; nh++) K.hide(M.th, nh);
      M.te.instanceMatrix.needsUpdate = M.th.instanceMatrix.needsUpdate = true;
    },
  };
})();
