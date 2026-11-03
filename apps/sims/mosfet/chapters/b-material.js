/* B 材料: 原子は中性 / シリコンと不純物 */
(() => {
  "use strict";
  const K = MOSKit, P = MOSPhys, T = THREE, V = K.V, C = K.C;
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
  const tint = (n) => (n > 0 ? "var(--hole)" : n < 0 ? "var(--electron)" : "var(--fg)");

  /* ===== 原子は中性(ボーア模型) ===== */
  const RADII = [1.0, 1.75, 2.5];
  const atom = { innerE: null, valE: null, freed: null, nucleus: null, zLabel: null, freedLabel: null, orbit: null, fp: V(0, 0, 0) };
  MOS.chapters.atom = {
    id: "atom", part: "B", title: "原子は中性", mag: 4e8, scale: "原子 1 個",
    state: { el: "Si", ion: 0, anim: 1 },
    prompt: "原子を切り替えて、＋と−の数を比べよう。外側の電子を 1 個はがしてみよう。",
    controls: [
      { type: "seg", id: "el", label: "原子", options: [["Si", "シリコン Si"], ["P", "リン P"], ["B", "ホウ素 B"]] },
      { type: "buttons", items: [{ id: "ion", label: "外側の電子を 1 個はがす" }, { id: "back", label: "戻す" }] },
    ],
    note: "原子の絵はボーア模型(簡略化した絵)です。実際の電子は軌道を回る粒ではなく、雲のように広がっています。大きさの比も実際とは違います(原子核は原子の 10 万分の 1 ほどの大きさ)。",
    meters: [
      { id: "p", k: "陽子(原子核)" },
      { id: "e", k: "電子(まわり)" },
      { id: "atom", k: "この原子の合計" },
      { id: "all", k: "はがした電子も含めた合計" },
    ],
    view: { pos: V(0, 3.2, 8.6), look: V(0.4, 0, 0) },
    build(ctx) {
      const g = new T.Group(), ids = ["atom"];
      atom.nucleus = new T.Mesh(new T.SphereGeometry(0.34, 32, 16), K.mat("#e9a35e", { emissive: C("#c0602a"), emissiveIntensity: 0.6, roughness: 0.4 }));
      g.add(atom.nucleus);
      atom.orbit = new T.Group(); atom.orbit.rotation.x = -1.15; g.add(atom.orbit);
      const ringMat = new T.MeshBasicMaterial({ color: C("#5f7a86"), transparent: true, opacity: 0.55 });
      RADII.forEach((r) => atom.orbit.add(new T.Mesh(new T.TorusGeometry(r, 0.008, 6, 96), ringMat)));
      atom.innerE = K.inst(K.electronGeo(0.085), new T.MeshStandardMaterial({ color: C("#7fb9c6"), emissive: C("#2a6f80"), emissiveIntensity: 0.5 }), 12);
      atom.valE = K.inst(K.electronGeo(0.1), K.electronMat(), 6);
      atom.orbit.add(atom.innerE, atom.valE);
      atom.freed = new T.Mesh(K.electronGeo(0.11), K.electronMat()); g.add(atom.freed);
      atom.zLabel = ctx.label("+14", V(0, 0.75, 0), ids, "big");
      atom.freedLabel = ctx.label("はがした電子 −1", V(3.6, 1.3, 0.8), ids, "e");
      ctx.label("いちばん外側 = 価電子", V(2.3, -1.3, 1.9), ids, "e");
      return g;
    },
    onInput(ctx, id) { if (id === "el") { ctx.S.atom.ion = 0; } },
    onButton(ctx, b) {
      const S = ctx.S.atom;
      if (b === "ion" && !S.ion) { S.ion = 1; S.anim = 0; }
      if (b === "back") S.ion = 0;
    },
    update(ctx, S) {
      const a = P.ATOMS[S.el], bound = a.Z - S.ion, q = P.atomCharge(a.Z, bound, S.ion);
      atom.zLabel.set(`+${a.Z}`);
      const val = a.shells[a.shells.length - 1];
      let ex;
      if (S.ion) ex = `外側の電子を 1 個はがすと、原子は＋1 のイオンになります。でも、はがした電子(−1)と合わせれば合計は 0 のまま。電荷は消えたり生まれたりせず、場所が分かれただけです。`;
      else if (S.el === "Si") ex = "シリコンの原子核には陽子が 14 個(＋14)、まわりに電子が 14 個(−14)。合わせて 0 なので、原子は電気的に中性です。いちばん外側の 4 個(価電子)が、となりの原子と手をつなぐのに使われます。";
      else if (S.el === "P") ex = `リンは陽子 15 個・電子 15 個で、やはり中性。ただし外側の電子が ${val} 個あり、シリコンの結晶に入ると 1 個余ります(次の章)。`;
      else ex = `ホウ素は陽子 5 個・電子 5 個で中性。外側の電子は ${val} 個で、シリコンの結晶に入ると 1 個足りません(次の章)。`;
      return {
        goal: "電子をはがして合計を見る", met: !!S.ion, explain: ex,
        m: {
          p: [`+${a.Z}`, `${a.name}の原子番号 ${a.Z}`],
          e: [`−${bound}`, a.shells.map((n, i) => (i === a.shells.length - 1 ? n - S.ion : n)).join(" · ") + " 個(内 → 外)"],
          atom: [`<span style="color:${tint(q.atom)}">${signed(q.atom)}</span>`, q.atom === 0 ? "中性" : "＋のイオン"],
          all: [`${signed(q.total)}`, S.ion ? `イオン ${signed(q.atom)} と電子 ${signed(q.freed)}` : "はがした電子なし"],
        },
      };
    },
    frame(ctx, dt, S) {
      const a = P.ATOMS[S.el], t = ctx.t;
      let ii = 0, vi = 0;
      a.shells.forEach((n, si) => {
        const val = si === a.shells.length - 1, count = val ? n - S.ion : n;
        for (let k = 0; k < count; k++) {
          const th = (k / n) * Math.PI * 2 + t * (0.9 - si * 0.25) + si;
          const x = RADII[si] * Math.cos(th), y = RADII[si] * Math.sin(th);
          if (val) K.put(atom.valE, vi++, x, y, 0); else K.put(atom.innerE, ii++, x, y, 0);
        }
      });
      for (; ii < 12; ii++) K.hide(atom.innerE, ii);
      for (; vi < 6; vi++) K.hide(atom.valE, vi);
      atom.innerE.instanceMatrix.needsUpdate = atom.valE.instanceMatrix.needsUpdate = true;
      S.anim = Math.min(1, S.anim + dt * 0.8);
      atom.freed.visible = !!S.ion; atom.freedLabel.hidden = !S.ion;
      if (S.ion) {
        const e = K.smooth(0, 1, S.anim), r = RADII[a.shells.length - 1];
        atom.freed.position.set(r * (1 - e) * 0.9 + e * 3.6, e * 0.8 + Math.sin(t * 1.3) * 0.05 * e, e * 0.8);
      }
    },
  };

  /* ===== シリコンと不純物(結晶を平面に広げた模式図) ===== */
  const COLS = 11, ROWS = 7, X0 = -(COLS - 1) / 2, Z0 = -(ROWS - 1) / 2, NA = COLS * ROWS;
  const pos = (i) => ({ x: X0 + (i % COLS), z: Z0 + Math.floor(i / COLS) });
  const bonds = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (c < COLS - 1) bonds.push({ a: i, b: i + 1, h: true });
    if (r < ROWS - 1) bonds.push({ a: i, b: i + COLS, h: false });
  }
  bonds.forEach((b) => { const p = pos(b.a), q = pos(b.b); b.x = (p.x + q.x) / 2; b.z = (p.z + q.z) / 2; });
  const bondsOf = Array.from({ length: NA }, () => []);
  bonds.forEach((b, k) => { bondsOf[b.a].push(k); bondsOf[b.b].push(k); });
  const SIZES = { 1: 0.55, 3: 1.55, 5: 2.55 };
  const D = { kind: new Array(NA).fill("Si"), elec: [], holes: [], rnd: K.rng(11) };
  const M = {};

  function placeDopant(i, kind) {
    const old = D.kind[i];
    if (old === kind) return;
    D.elec = D.elec.filter((e) => e.owner !== i);
    D.holes = D.holes.filter((h) => h.owner !== i);
    D.kind[i] = kind;
    const p = pos(i);
    if (kind === "P") D.elec.push({ owner: i, x: p.x, z: p.z, vx: 0, vz: 0 });
    if (kind === "B") { const bs = bondsOf[i]; D.holes.push({ owner: i, bond: bs[Math.floor(D.rnd() * bs.length)], next: 0.4 }); }
  }
  function scatter(kind, n) {
    const free = [];
    for (let i = 0; i < NA; i++) { const p = pos(i); if (D.kind[i] === "Si" && Math.abs(p.x) < 4.6 && Math.abs(p.z) < 2.6) free.push(i); }
    for (let k = 0; k < n && free.length; k++) placeDopant(free.splice(Math.floor(D.rnd() * free.length), 1)[0], kind);
  }
  function frameBox(S) {
    if (S.size === "all") return { x: 0, z: 0, hx: (COLS - 1) / 2 + 0.6, hz: (ROWS - 1) / 2 + 0.6 };
    return { x: S.fx, z: S.fz, hx: SIZES[S.size], hz: SIZES[S.size] };
  }
  function count(S) {
    const f = frameBox(S), inF = (x, z) => Math.abs(x - f.x) <= f.hx && Math.abs(z - f.z) <= f.hz;
    const r = { pos: 0, neg: 0, e: 0, h: 0, all: 0, nP: 0, nB: 0 };
    for (let i = 0; i < NA; i++) {
      const p = pos(i);
      if (D.kind[i] === "P") { r.nP++; r.all++; if (inF(p.x, p.z)) r.pos++; }
      if (D.kind[i] === "B") { r.nB++; r.all--; if (inF(p.x, p.z)) r.neg++; }
    }
    for (const e of D.elec) { r.all--; if (inF(e.x, e.z)) r.e++; }
    for (const h of D.holes) { const b = bonds[h.bond]; r.all++; if (inF(b.x, b.z)) r.h++; }
    r.sum = r.pos - r.neg - r.e + r.h;
    return r;
  }
  function planeHit(ray) { const p = new T.Vector3(); return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), p) ? p : null; }

  MOS.chapters.dope = {
    id: "dope", part: "B", title: "シリコンと不純物", mag: 7e7, scale: "シリコンの結晶",
    state: { tool: "P", size: "all", fx: 0, fz: 0 },
    prompt: "結晶の原子をタップして、リンやホウ素に入れ替えよう。白い枠の中の電荷の合計を見てみよう。",
    controls: [
      { type: "seg", id: "tool", label: "タップで置く", options: [["P", "リン P(n 型)"], ["B", "ホウ素 B(p 型)"], ["Si", "シリコンに戻す"]] },
      { type: "seg", id: "size", label: "枠の大きさ(小さい枠はドラッグで動かせる)", options: [["1", "原子 1 個"], ["3", "3 × 3"], ["5", "5 × 5"], ["all", "結晶全体"]] },
      { type: "buttons", items: [{ id: "sp", label: "リンを 4 個まく" }, { id: "sb", label: "ホウ素を 4 個まく" }, { id: "reset", label: "全部シリコンに戻す" }] },
    ],
    note: "結晶を平面に広げた模式図です(実際は立体のダイヤモンド構造)。原子の間の 2 つの点は、結合に使われている電子 2 個。室温の純粋なシリコンで熱によって結合が切れるのは 10¹² 個に 1 個以下なので、ここでは省いています。",
    meters: [
      { id: "sum", k: "枠の中の電荷の合計" },
      { id: "parts", k: "枠の中の内訳" },
      { id: "all", k: "結晶全体の合計" },
    ],
    legend: ["e", "h", "pos", "neg"],
    view: { pos: V(0, 9.6, 6.8), look: V(0, 0, 0.5) },
    orbit: false, live: true,
    build(ctx) {
      const g = new T.Group(), ids = ["dope"];
      M.si = K.inst(new T.SphereGeometry(0.2, 16, 12), K.mat("#8fa3ab", { metalness: 0.3, roughness: 0.45 }), NA);
      M.p = K.inst(new T.SphereGeometry(0.24, 16, 12), K.mat("#d8a548", { metalness: 0.3, emissive: C("#7a5410"), emissiveIntensity: 0.4 }), NA);
      M.b = K.inst(new T.SphereGeometry(0.2, 16, 12), K.mat("#a99bff", { metalness: 0.3, emissive: C("#4b3aa8"), emissiveIntensity: 0.4 }), NA);
      const bondGeoH = new T.BoxGeometry(1, 0.02, 0.02), bondGeoV = new T.BoxGeometry(0.02, 0.02, 1);
      const bondMat = new T.MeshBasicMaterial({ color: C("#3f5560") });
      const bh = K.inst(bondGeoH, bondMat, bonds.length), bv = K.inst(bondGeoV, bondMat, bonds.length);
      M.dots = K.inst(new T.SphereGeometry(0.055, 8, 6), new T.MeshStandardMaterial({ color: C("#7fb9c6"), emissive: C("#2a6f80"), emissiveIntensity: 0.4 }), bonds.length * 2);
      bonds.forEach((b, k) => {
        if (b.h) { K.put(bh, k, b.x, 0, b.z); K.hide(bv, k); } else { K.put(bv, k, b.x, 0, b.z); K.hide(bh, k); }
      });
      g.add(M.si, M.p, M.b, bh, bv, M.dots);
      M.plus = K.signs(NA, "#ffd27a", true, 0.26); M.minus = K.signs(NA, "#c6bcff", false, 0.26);
      g.add(M.plus.group, M.minus.group);
      M.e = K.inst(K.electronGeo(0.1), K.electronMat(), NA);
      const hg = K.holeGeo(0.12); hg.rotateX(Math.PI / 2);
      M.h = K.inst(hg, K.holeMat(), NA);
      g.add(M.e, M.h);
      const sq = new T.BufferGeometry().setFromPoints([V(-1, 0, -1), V(1, 0, -1), V(1, 0, 1), V(-1, 0, 1), V(-1, 0, -1)]);
      M.frame = new T.Line(sq, new T.LineBasicMaterial({ color: C("#eaf3f5") })); M.frame.position.y = 0.05; g.add(M.frame);
      M.sumLabel = ctx.label("0", V(0, 0.3, 0), ids, "big");
      ctx.label("シリコンの結晶(平面に広げた模式図)", V(0, 0, Z0 - 0.9), ids);
      return g;
    },
    onButton(ctx, b) {
      if (b === "sp") scatter("P", 4);
      if (b === "sb") scatter("B", 4);
      if (b === "reset") for (let i = 0; i < NA; i++) placeDopant(i, "Si");
    },
    onClick(ctx, ray) {
      const p = planeHit(ray); if (!p) return;
      let best = -1, bd = 0.5;
      for (let i = 0; i < NA; i++) { const q = pos(i), d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = i; } }
      if (best >= 0) placeDopant(best, ctx.S.dope.tool);
    },
    onDrag(ctx, ray, phase) {
      const S = ctx.S.dope; if (phase !== "move" || S.size === "all") return;
      const p = planeHit(ray); if (!p) return;
      S.fx = K.clamp(p.x, X0, -X0); S.fz = K.clamp(p.z, Z0, -Z0);
    },
    onInput(ctx, id) {
      const S = ctx.S.dope;
      if (id === "size" && S.size !== "all" && S.fx === 0 && S.fz === 0) {
        const d = D.kind.findIndex((k) => k !== "Si");
        if (d >= 0) { const p = pos(d); S.fx = p.x; S.fz = p.z; }
      }
    },
    update(ctx, S) {
      const r = count(S);
      const hasP = r.nP > 0, hasB = r.nB > 0;
      let ex;
      if (!hasP && !hasB) ex = "純粋なシリコン。どの原子も 4 本の手でとなりと電子を出し合って結合しています(線の上の点が電子)。自由に動ける電子も正孔もほとんどありません。リンかホウ素を置いてみよう。";
      else if (hasP && !hasB) ex = "リンの 5 個目の電子は結合に使われず、室温ではすぐに離れて自由に動き回ります(水色の球)。残ったリンは動けない＋イオン(＋の記号)。自由電子とイオンは同じ数なので、結晶全体は中性のままです。";
      else if (hasB && !hasP) ex = "ホウ素は手が 1 本足りないので、となりの結合から電子を 1 個もらいます。ホウ素は動けない−イオン(−の記号)になり、電子が抜けた席(正孔、輪)が次々と移っていきます。正孔とイオンは同じ数なので、結晶全体は中性のままです。";
      else ex = "リンとホウ素の両方が入っています。それぞれのイオンと、同じ数の自由電子・正孔があるので、結晶全体は中性のままです。";
      if (S.size !== "all" && (hasP || hasB)) {
        ex += r.sum !== 0
          ? " いま枠の中だけを見ると、電荷が釣り合っていません。動ける電子や正孔が枠の外に出て、動けないイオンの電荷が「むき出し」になっているからです。これが次の PN 接合で起きることです。"
          : " 枠の中ではいま釣り合っています。電子や正孔が出入りすると、合計が変わるのを見てみよう。";
      } else if (hasP || hasB) ex += " 枠を小さくして、イオンのまわりだけを囲んでみよう。";
      const typ = hasP && hasB ? (r.nP > r.nB ? "n 型寄り" : r.nP < r.nB ? "p 型寄り" : "打ち消し合い") : hasP ? "n 型" : hasB ? "p 型" : "純粋(真性)";
      M.sumLabel.set(`<span style="color:${tint(r.sum)}">${signed(r.sum)}</span>`);
      return {
        goal: "不純物を入れて、全体の合計を確かめる", met: (hasP || hasB) && S.size === "all",
        explain: ex,
        m: {
          sum: [`<span style="color:${tint(r.sum)}">${signed(r.sum)}</span>`, S.size === "all" ? "枠 = 結晶全体" : "枠の中だけ"],
          parts: [`<span style="font-size:15px">＋${r.pos} −${r.neg} <span style="color:var(--electron)">e ${r.e}</span> <span style="color:var(--hole)">h ${r.h}</span></span>`, "＋イオン · −イオン · 電子 · 正孔"],
          all: [signed(r.all), typ],
        },
      };
    },
    frame(ctx, dt, S) {
      const red = ctx.reduced;
      const hiddenDot = new Set(D.holes.map((h) => h.bond * 2));
      let np = 0, nb = 0;
      for (let i = 0; i < NA; i++) {
        const p = pos(i), k = D.kind[i];
        if (k === "Si") K.put(M.si, i, p.x, 0, p.z); else K.hide(M.si, i);
        if (k === "P") { K.put(M.p, i, p.x, 0, p.z); M.plus.set(i, p.x, 0.42, p.z); np++; } else { K.hide(M.p, i); M.plus.hide(i); }
        if (k === "B") { K.put(M.b, i, p.x, 0, p.z); M.minus.set(i, p.x, 0.42, p.z); nb++; } else { K.hide(M.b, i); M.minus.hide(i); }
      }
      bonds.forEach((b, k) => {
        const off = 0.075;
        for (let s = 0; s < 2; s++) {
          if (hiddenDot.has(k * 2 + s)) { K.hide(M.dots, k * 2 + s); continue; }
          const sg = s ? 1 : -1;
          K.put(M.dots, k * 2 + s, b.x + (b.h ? 0 : sg * off), 0.02, b.z + (b.h ? sg * off : 0));
        }
      });
      // 自由電子: なめらかなランダムウォーク(結晶の中に閉じ込める)
      D.elec.forEach((e, i) => {
        if (!red) {
          e.vx += (D.rnd() - 0.5) * 6 * dt; e.vz += (D.rnd() - 0.5) * 6 * dt;
          const sp = Math.hypot(e.vx, e.vz), max = 1.1; if (sp > max) { e.vx *= max / sp; e.vz *= max / sp; }
          e.x += e.vx * dt; e.z += e.vz * dt;
          if (Math.abs(e.x) > -X0 + 0.3) { e.x = Math.sign(e.x) * (-X0 + 0.3); e.vx *= -1; }
          if (Math.abs(e.z) > -Z0 + 0.3) { e.z = Math.sign(e.z) * (-Z0 + 0.3); e.vz *= -1; }
        }
        K.put(M.e, i, e.x, 0.12, e.z);
      });
      for (let i = D.elec.length; i < NA; i++) K.hide(M.e, i);
      // 正孔: となりの結合へ跳び移る(空席が移る)
      D.holes.forEach((h, i) => {
        if (!red) {
          h.next -= dt;
          if (h.next <= 0) {
            const b = bonds[h.bond], cand = bondsOf[b.a].concat(bondsOf[b.b]).filter((k) => k !== h.bond);
            h.bond = cand[Math.floor(D.rnd() * cand.length)]; h.next = 0.3 + D.rnd() * 0.5;
          }
        }
        const b = bonds[h.bond]; K.put(M.h, i, b.x, 0.06, b.z);
      });
      for (let i = D.holes.length; i < NA; i++) K.hide(M.h, i);
      [M.si, M.p, M.b, M.dots, M.e, M.h].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
      M.plus.done(); M.minus.done();
      const f = frameBox(S);
      M.frame.position.x = f.x; M.frame.position.z = f.z; M.frame.scale.set(f.hx, 1, f.hz);
      M.sumLabel.pos.set(f.x, 0.3, f.z - f.hz - 0.35);
    },
  };
})();
