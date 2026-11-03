/* D MOS: 通り道をつくる / 流れと頭打ち / 基板の電圧(3 章で 1 つの断面を共有) */
(() => {
  "use strict";
  const K = MOSKit, P = MOSPhys, T = THREE, V = K.V, C = K.C;
  const pill = (t, v) => `<span class="pill" style="color:var(${v})">${t}</span>`;
  const IDS = ["channel", "flow", "body"];
  const fmtA = (a) => (a >= 0.1 ? (a * 1000).toFixed(0) : a >= 0.001 ? (a * 1000).toFixed(1) : (a * 1000).toFixed(2));

  /* ---- 共有の断面 ---- */
  let cell = null;
  function buildCell(ctx) {
    const g = new T.Group(), rnd = K.rng(7), c = { group: g };
    const sub = new T.Mesh(new T.BoxGeometry(12, 4, 4), K.glass("#5b3a52", 0.16)); sub.position.set(0, -2, 0); sub.renderOrder = 3; g.add(sub, K.edges(sub, "#8b6a80", 0.55));
    const nS = new T.Mesh(new T.BoxGeometry(3, 1.2, 4), K.glass("#2b7f95", 0.2)); nS.position.set(-4.5, -0.6, 0); nS.renderOrder = 4;
    const nD = nS.clone(); nD.position.set(4.5, -0.6, 0);
    g.add(nS, nD, K.edges(nS, "#5fe1f5", 0.45), K.edges(nD, "#5fe1f5", 0.45));
    const oxide = new T.Mesh(new T.BoxGeometry(6.4, 0.22, 4), K.glass("#e9f1f3", 0.35)); oxide.position.set(0, 0.11, 0); oxide.renderOrder = 5; g.add(oxide, K.edges(oxide, "#e9f1f3", 0.5));
    c.gateMat = K.mat("#d8a548", { metalness: 0.7, roughness: 0.35, emissive: C("#d8a548"), emissiveIntensity: 0 });
    g.add(K.box(6, 0.7, 4, c.gateMat, 0, 0.57, 0));
    const metal = K.mat("#aeb8bc", { metalness: 0.8, roughness: 0.3 });
    [-4.5, 4.5].forEach((x) => g.add(K.box(0.7, 1.2, 1.2, metal, x, 0.6, 0)));
    g.add(K.box(0.7, 0.7, 1.2, metal, 0, 1.27, 0));
    g.add(K.box(12, 0.14, 4, K.mat("#8f999d", { metalness: 0.8, roughness: 0.35 }), 0, -4.07, 0));

    c.holes = [];
    while (c.holes.length < 520) {
      const x = -5.85 + rnd() * 11.7, y = -3.85 + rnd() * 3.75, z = -1.85 + rnd() * 3.7;
      if (Math.abs(x) > 2.95 && y > -1.25) continue;
      c.holes.push({ x, y, z, cy: y, p: rnd() * 6.28 });
    }
    const hg = K.holeGeo(0.085);
    c.holeMesh = K.inst(hg, K.holeMat(), c.holes.length); g.add(c.holeMesh);
    c.ions = [];
    for (let x = -2.75; x <= 2.76; x += 0.5) for (let y = -0.15; y >= -2.75; y -= 0.29) for (let z = -1.6; z <= 1.61; z += 0.8) c.ions.push({ x, y, z, s: 0 });
    c.ionSigns = K.signs(c.ions.length, "#a99bff", false, 0.17); g.add(c.ionSigns.group);
    c.nElec = [];
    for (let i = 0; i < 300; i++) { const side = i % 2 ? 1 : -1; c.nElec.push({ x: side * (3.05 + rnd() * 2.85), y: -1.15 + rnd() * 1.1, z: -1.85 + rnd() * 3.7, p: rnd() * 6.28 }); }
    const em = K.electronMat();
    c.nMesh = K.inst(K.electronGeo(), em, 300); g.add(c.nMesh);
    c.chE = []; for (let i = 0; i < 300; i++) c.chE.push({ u: rnd(), r: rnd(), z: -1.85 + rnd() * 3.7 });
    c.chMesh = K.inst(K.electronGeo(), em, 300); g.add(c.chMesh);
    c.flowArrow = new T.ArrowHelper(V(1, 0, 0), V(-2.2, -2.6, 2.05), 4.4, 0x5fe1f5, 0.35, 0.22); g.add(c.flowArrow);
    c.rnd = rnd;

    ctx.label("ゲート G", V(0, 1.75, 0), IDS, "g");
    ctx.label("ソース S", V(-4.5, 1.6, 0), IDS, "strong");
    ctx.label("ドレイン D", V(4.5, 1.6, 0), IDS, "strong");
    ctx.label("酸化膜(絶縁体)", V(-3.9, 0.2, 2.4), IDS);
    ctx.label("n⁺", V(-4.5, -0.6, 2.15), IDS, "e"); ctx.label("n⁺", V(4.5, -0.6, 2.15), IDS, "e");
    ctx.label("p 型シリコン", V(0, -3.5, 2.15), IDS, "h");
    ctx.label("基板 B(S とつないである)", V(0, -4.45, 2.15), ["channel", "flow"]);
    c.bodyLbl = ctx.label("基板 B", V(0, -4.45, 2.15), ["body"], "strong");
    c.flowLbl = ctx.label("電子の流れ →  ·  電流 I_D ←".replace("I_D", "I<sub>D</sub>"), V(0, -2.95, 2.1), ["flow"], "e");
    return c;
  }
  function getCell(ctx) { if (!cell) cell = buildCell(ctx); return cell.group; }

  // 断面の 1 フレーム(vgs, vds, vsb から)
  function step(ctx, dt, vgs, vds, vsb, flowing) {
    const c = cell, t = ctx.t, red = ctx.reduced, vth = P.vthOf(vsb);
    const psi = P.PHI2 * K.clamp(vgs / vth, 0, 1);
    const dep = 1.1 * Math.sqrt((psi + vsb) / P.PHI2);
    c.gateMat.emissiveIntensity = Math.min(1, vgs / 5) * 0.35;
    const mask = (x) => { const a = Math.abs(x); return a < 2.6 ? 1 : a > 3.4 ? 0 : 1 - (a - 2.6) / 0.8; };
    c.holes.forEach((h, i) => {
      const d = dep * mask(h.x), target = -4 + (h.y + 4) * (4 - d) / 4;
      h.cy += (target - h.cy) * Math.min(1, dt * 4 + (red ? 1 : 0));
      const j = red ? 0 : 0.03;
      K.put(c.holeMesh, i, h.x + Math.sin(t * 2.1 + h.p) * j, h.cy + Math.cos(t * 1.7 + h.p) * j, h.z);
    });
    c.holeMesh.instanceMatrix.needsUpdate = true;
    c.ions.forEach((o, i) => {
      const show = o.y > -dep * mask(o.x) ? 1 : 0;
      o.s += (show - o.s) * Math.min(1, dt * 5 + (red ? 1 : 0));
      if (o.s < 0.02) c.ionSigns.hide(i); else c.ionSigns.set(i, o.x, o.y, o.z, o.s);
    });
    c.ionSigns.done();
    c.nElec.forEach((e, i) => { const j = red ? 0 : 0.035; K.put(c.nMesh, i, e.x + Math.sin(t * 2.6 + e.p) * j, e.y + Math.cos(t * 2.2 + e.p) * j, e.z); });
    c.nMesh.instanceMatrix.needsUpdate = true;
    const vov = vgs - vth, frac = vov > 0 ? Math.min(1, vov / 3) : 0, id = flowing ? P.idMos(vgs, vds, vth) : 0;
    const cflow = id > 0 ? (0.12 + 0.9 * id / 0.45) * Math.max(vov, 0.01) : 0;
    c.chE.forEach((e, i) => {
      if (i >= c.chE.length * frac) { K.hide(c.chMesh, i); return; }
      const q = P.channelQ(vgs, vds, e.u, vth);
      if (cflow > 0 && !red) { e.u += Math.min(2.5, cflow / Math.max(q, 0.06)) * dt * 0.25; if (e.u > 1) { e.u -= 1; e.r = c.rnd(); } }
      K.put(c.chMesh, i, -3 + 6 * e.u, -0.03 - e.r * (0.05 + 0.13 * q), e.z);
    });
    c.chMesh.instanceMatrix.needsUpdate = true;
    c.flowArrow.visible = flowing && id > 0 && vds > 0.05;
    c.flowLbl.hidden = !c.flowArrow.visible;
  }

  const common = {
    part: "D", mag: 1e5, scale: "セル 1 個の断面", legend: ["e", "h", "neg"],
    view: { pos: V(0, 1.6, 14.5), look: V(0, -2.0, 0) },
    build: getCell,
  };
  const NOTE = "模式図です。実物の部品(パワー MOSFET)は縦型の構造で、この形のセルが大量に並んでいます。数値は簡易モデル(二乗則、V_th = 2.0 V)によるものです。";

  /* ===== 通り道をつくる ===== */
  MOS.chapters.channel = Object.assign({}, common, {
    id: "channel", title: "通り道をつくる",
    state: { vgs: 0 },
    prompt: "V_GS を少しずつ上げて、電子の通り道(チャネル)をつくろう。",
    controls: [{ type: "range", id: "vgs", label: "ゲート電圧 V_GS", min: 0, max: 5, step: 0.05, fmt: (v) => `${v.toFixed(2)} V` }],
    note: NOTE + " この章では基板 B をソース S とつないでいます(V_SB = 0)。",
    meters: [{ id: "vgs", k: "V_GS" }, { id: "ig", k: "I_G ゲート電流" }, { id: "ch", k: "チャネル" }],
    update(ctx, S) {
      const vov = S.vgs - P.VTH0, frac = vov > 0 ? Math.min(1, vov / 3) : 0;
      return {
        goal: "チャネルをつくる", met: vov > 0.5,
        explain: S.vgs < 0.3
          ? "ゲートに電圧なし。p 型シリコンの中は正孔でいっぱいで、ソースとドレインはつながっていません。"
          : vov <= 0
            ? "ゲートの＋がつくる電場で、正孔が下へ押しやられました。表面には動けない−イオンだけが残り(空乏層)、そこに電場があります。まだ電子は集まっていません。"
            : "しきい値を超え、電場に引き寄せられた電子が酸化膜のすぐ下に集まって、ソースとドレインをつなぐ通り道(反転層＝チャネル)ができました。電子はゲートからではなく、ソースとドレインの n⁺ 領域から来ます。",
        m: {
          vgs: [`${S.vgs.toFixed(2)}<small>V</small>`, "しきい値 2.0 V"],
          ig: ["0<small>A</small>", "酸化膜で絶縁"],
          ch: [vov > 0 ? pill("できた", "--electron") : S.vgs > 0.3 ? pill("空乏層だけ", "--ion") : pill("なし", "--muted"), `表面の電子 ${Math.round(frac * 100)}%`],
        },
      };
    },
    frame(ctx, dt, S) { step(ctx, dt, S.vgs, 0, 0, false); },
  });

  /* ===== 流れと頭打ち ===== */
  MOS.chapters.flow = Object.assign({}, common, {
    id: "flow", title: "流れと頭打ち",
    state: { vgs: 3.5, vds: 0 },
    prompt: "V_DS を上げて、電流が頭打ちになる(飽和)ところを探そう。",
    controls: [
      { type: "range", id: "vgs", label: "ゲート電圧 V_GS", min: 0, max: 5, step: 0.05, fmt: (v) => `${v.toFixed(2)} V` },
      { type: "range", id: "vds", label: "ドレイン電圧 V_DS", min: 0, max: 5, step: 0.05, fmt: (v) => `${v.toFixed(2)} V` },
    ],
    note: NOTE + " この章では基板 B をソース S とつないでいます(V_SB = 0)。",
    meters: [{ id: "vgs", k: "V_GS" }, { id: "id", k: "I_D ドレイン電流" }],
    graph: { label: "I_D–V_DS 特性", aria: "ドレイン電流とドレイン電圧のグラフ" },
    update(ctx, S) {
      const id = P.idMos(S.vgs, S.vds), reg = P.region(S.vgs, S.vds), vov = S.vgs - P.VTH0;
      return {
        goal: "飽和させる", met: reg === "sat" && S.vds > 0.05,
        explain: reg === "cut"
          ? "V_GS がしきい値より低く、チャネルがありません。V_DS をかけても電流は流れません。"
          : S.vds < 0.05
            ? "チャネルはあるが、V_DS が 0 なので電子を押す電場がありません。V_DS を上げてみよう。"
            : reg === "lin"
              ? `V_DS がつくる横向きの電場で電子が流れます。V_DS を上げるほど電流が増えます(線形領域)。ドレイン側ほどチャネルが細くなっていくのに注目。V_DS が ${vov.toFixed(2)} V(= V_GS − V_th)に届くと…`
              : "ドレイン側でチャネルが閉じました(ピンチオフ)。それでも電流は止まりません。ピンチオフ点からドレインまでの短い区間に強い電場がかかり、電子を一気に運ぶからです。ただし V_DS をさらに上げても、その電圧はこの短い区間にかかるだけで、電流はほぼ増えません(飽和領域)。",
        m: {
          vgs: [`${S.vgs.toFixed(2)}<small>V</small>`, "しきい値 2.0 V"],
          id: [`${fmtA(id)}<small>mA</small>`, reg === "cut" ? pill("遮断", "--muted") : reg === "lin" ? pill("線形", "--electron") : pill("飽和", "--gate")],
        },
      };
    },
    draw(ctx, cv, S) {
      const { ctx: c, W, H } = K.canvas2d(cv);
      const L = 40, R = 10, T0 = 8, B = 26, pw = W - L - R, ph = H - T0 - B, IMAX = 0.5;
      const X = (v) => L + v / 5 * pw, Y = (i) => T0 + ph - i / IMAX * ph;
      const muted = K.css("--muted"), line = K.css("--line"), acc = K.css("--electron"), gate = K.css("--gate");
      c.fillStyle = muted; c.strokeStyle = line;
      for (let v = 0; v <= 5; v++) { c.beginPath(); c.moveTo(X(v), T0); c.lineTo(X(v), T0 + ph); c.stroke(); c.textAlign = "center"; c.fillText(v, X(v), H - 12); }
      for (let i = 0; i <= 0.5001; i += 0.1) { c.beginPath(); c.moveTo(L, Y(i)); c.lineTo(L + pw, Y(i)); c.stroke(); c.textAlign = "right"; c.fillText(Math.round(i * 1000), L - 5, Y(i) + 3); }
      c.textAlign = "right"; c.fillText("V_DS [V]", L + pw, H - 1); c.textAlign = "left"; c.fillText("mA", 2, T0 + 8);
      c.setLineDash([3, 3]); c.strokeStyle = gate; c.globalAlpha = 0.7; c.beginPath();
      for (let v = 0; v <= 3.0; v += 0.05) { const i = P.K / 2 * v * v; v === 0 ? c.moveTo(X(v), Y(i)) : c.lineTo(X(v), Y(i)); }
      c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      [3, 4, 5].forEach((vg) => {
        c.strokeStyle = muted; c.globalAlpha = 0.45; c.beginPath();
        for (let v = 0; v <= 5; v += 0.05) { const i = P.idMos(vg, v); v === 0 ? c.moveTo(X(v), Y(i)) : c.lineTo(X(v), Y(i)); }
        c.stroke(); c.globalAlpha = 1; c.fillStyle = muted; c.textAlign = "right"; c.fillText(`${vg} V`, L + pw - 2, Y(P.idMos(vg, 5)) - 4);
      });
      c.strokeStyle = acc; c.lineWidth = 2; c.beginPath();
      for (let v = 0; v <= 5; v += 0.025) { const i = P.idMos(S.vgs, v); v === 0 ? c.moveTo(X(v), Y(i)) : c.lineTo(X(v), Y(i)); }
      c.stroke();
      const id = P.idMos(S.vgs, S.vds);
      c.fillStyle = acc; c.beginPath(); c.arc(X(S.vds), Y(id), 4.5, 0, 6.29); c.fill();
      c.strokeStyle = K.css("--fg"); c.lineWidth = 1.5; c.stroke();
    },
    frame(ctx, dt, S) { step(ctx, dt, S.vgs, S.vds, 0, true); },
  });

  /* ===== 基板の電圧 ===== */
  MOS.chapters.body = Object.assign({}, common, {
    id: "body", title: "基板の電圧",
    state: { vgs: 2.3, vsb: 0 },
    prompt: "V_GS はそのままで、V_SB だけを上げてチャネルを消してみよう。",
    controls: [
      { type: "range", id: "vgs", label: "ゲート電圧 V_GS", min: 0, max: 5, step: 0.05, fmt: (v) => `${v.toFixed(2)} V` },
      { type: "range", id: "vsb", label: "ソースから見た基板の低さ V_SB", min: 0, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)} V` },
    ],
    note: "V_th = V_th0 + γ(√(2φ<sub>F</sub> + V_SB) − √(2φ<sub>F</sub>))。この模型では V_th0 = 2.0 V、γ = 0.5 V<sup>½</sup>、2φ<sub>F</sub> = 0.7 V。ソースが GND にない回路(トランジスタを縦に積んだ回路やソースフォロワ)で効いてきます。",
    meters: [{ id: "vgs", k: "V_GS" }, { id: "vth", k: "V_th しきい値" }, { id: "ch", k: "チャネル" }],
    graph: { label: "V_th–V_SB(基板バイアス効果)", aria: "しきい値電圧と基板バイアスのグラフ" },
    update(ctx, S) {
      const vth = P.vthOf(S.vsb), vov = S.vgs - vth, frac = vov > 0 ? Math.min(1, vov / 3) : 0;
      cell.bodyLbl.set(S.vsb < 0.025 ? "基板 B(S と同じ電圧)" : `基板 B(S より ${S.vsb.toFixed(2)} V 低い)`);
      const ex = S.vsb < 0.025
        ? (vov > 0 ? "いまは基板 B とソース S が同じ電圧で、これまでの章と同じ状態。チャネルができています。V_SB を上げて、基板をソースより低い電圧にしてみよう。"
                   : "いまは基板 B とソース S が同じ電圧。まず V_GS をしきい値(2.0 V)より上げて、チャネルをつくっておこう。")
        : vov > 0
          ? "基板を下げると空乏層が深くなり、動けない−イオンが増えます。その負の電荷がゲートの＋がつくる電場を受け止めてしまうので、しきい値 V_th が上がり、同じ V_GS でも集まる電子が減ります。これが基板バイアス効果です。"
          : S.vgs > P.VTH0
            ? "V_GS は同じなのに、しきい値が V_GS を超えてチャネルが消えました。基板の電圧だけで、オンとオフの境目が動いたことになります。"
            : "V_GS がしきい値より低く、チャネルはありません。V_GS を少し上げてから V_SB を動かしてみよう。";
      return {
        goal: "V_SB だけでチャネルを消す", met: S.vgs > P.VTH0 && vov <= 0, explain: ex,
        m: {
          vgs: [`${S.vgs.toFixed(2)}<small>V</small>`, `しきい値 ${vth.toFixed(2)} V`],
          vth: [`${vth.toFixed(2)}<small>V</small>`, S.vsb < 0.025 ? "V_SB = 0 のときと同じ" : `V_SB = 0 より +${(vth - P.VTH0).toFixed(2)} V`],
          ch: [vov > 0 ? pill("できた", "--electron") : pill("なし", "--muted"), `表面の電子 ${Math.round(frac * 100)}%`],
        },
      };
    },
    draw(ctx, cv, S) {
      const { ctx: c, W, H } = K.canvas2d(cv);
      const L = 40, R = 10, T0 = 8, B = 26, pw = W - L - R, ph = H - T0 - B, YMIN = 1.8, YMAX = 3.0;
      const X = (v) => L + v / 3 * pw, Y = (u) => T0 + ph - (u - YMIN) / (YMAX - YMIN) * ph;
      const muted = K.css("--muted"), line = K.css("--line"), acc = K.css("--electron"), gate = K.css("--gate");
      for (let v = 0; v <= 3; v++) { c.strokeStyle = line; c.beginPath(); c.moveTo(X(v), T0); c.lineTo(X(v), T0 + ph); c.stroke(); c.fillStyle = muted; c.textAlign = "center"; c.fillText(v, X(v), H - 12); }
      for (let u = 2.0; u <= 2.801; u += 0.2) { c.strokeStyle = line; c.beginPath(); c.moveTo(L, Y(u)); c.lineTo(L + pw, Y(u)); c.stroke(); c.fillStyle = muted; c.textAlign = "right"; c.fillText(u.toFixed(1), L - 5, Y(u) + 3); }
      c.textAlign = "right"; c.fillText("V_SB [V]", L + pw, H - 1); c.textAlign = "left"; c.fillText("V_th", 2, T0 + 8);
      if (S.vgs >= YMIN && S.vgs <= YMAX) {
        c.setLineDash([4, 3]); c.strokeStyle = gate; c.beginPath(); c.moveTo(L, Y(S.vgs)); c.lineTo(L + pw, Y(S.vgs)); c.stroke(); c.setLineDash([]);
        c.fillStyle = gate; c.textAlign = "left"; c.fillText(`V_GS ${S.vgs.toFixed(2)} V`, L + 4, Y(S.vgs) - 4);
      }
      c.strokeStyle = acc; c.lineWidth = 2; c.beginPath();
      for (let v = 0; v <= 3.001; v += 0.05) { const u = P.vthOf(v); v === 0 ? c.moveTo(X(v), Y(u)) : c.lineTo(X(v), Y(u)); }
      c.stroke();
      c.fillStyle = acc; c.beginPath(); c.arc(X(S.vsb), Y(P.vthOf(S.vsb)), 4.5, 0, 6.29); c.fill();
      c.strokeStyle = K.css("--fg"); c.lineWidth = 1.5; c.stroke();
    },
    frame(ctx, dt, S) { step(ctx, dt, S.vgs, 0, S.vsb, false); },
  });
})();
