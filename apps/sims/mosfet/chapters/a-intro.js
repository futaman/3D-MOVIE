/* A 入口: ただのスイッチ / 中をのぞく */
(() => {
  "use strict";
  const K = MOSKit, P = MOSPhys, T = THREE, V = K.V, C = K.C;
  const pill = (t, v) => `<span class="pill" style="color:var(${v})">${t}</span>`;

  /* ===== I ただのスイッチ ===== */
  let led, ledLight, knob, dots, loopCurve;
  const N_DOTS = 90, phase = Array.from({ length: N_DOTS }, (_, i) => i / N_DOTS);
  MOS.chapters.switch = {
    id: "switch", part: "A", title: "ただのスイッチ", mag: 1, scale: "机の上",
    state: { vgs: 0 },
    prompt: "ゲート電圧を上げて、LED を点けてみよう。",
    controls: [{ type: "range", id: "vgs", label: "ゲート電圧 V_GS", min: 0, max: 5, step: 0.05, fmt: (v) => `${v.toFixed(2)} V` }],
    meters: [
      { id: "vgs", k: "V_GS" },
      { id: "id", k: "I_D · LED" },
      { id: "ig", k: "I_G ゲート電流" },
    ],
    view: { pos: V(0, 7.2, 10.5), look: V(0, 0.4, -0.2) },
    build(ctx) {
      const g = new T.Group(), ids = ["switch"];
      g.add(K.box(13, 0.1, 7.6, K.mat("#152229", { roughness: 0.9 }), 0, -0.05, -0.3));
      const supply = K.box(1.6, 1.2, 2.2, K.mat("#2b3a43"), -4.4, 0.6, 0); g.add(supply, K.edges(supply, "#4b6370"));
      g.add(K.box(0.3, 0.12, 0.3, K.mat("#c0503f"), -4.4, 1.26, -0.7), K.box(0.3, 0.12, 0.3, K.mat("#20282c"), -4.4, 1.26, 0.7));
      const wire = K.mat("#b8c4c8", { metalness: 0.6, roughness: 0.35 });
      const loop = [V(-4.4, .15, .7), V(-4.4, .15, 1.9), V(4.25, .15, 1.9), V(4.25, .15, .3), V(4.25, .95, .3), V(4.0, .95, .3), V(4.0, .15, .3),
        V(4.0, .15, -2.5), V(1.4, .15, -2.5), V(-1.6, .15, -2.5), V(-4.4, .15, -2.5), V(-4.4, .15, -.7)];
      [[0, 3], [6, 8], [8, 10], [10, 11]].forEach(([a, b]) => g.add(new T.Mesh(new T.TubeGeometry(K.polyline(loop.slice(a, b + 1)), 64, 0.045, 8, false), wire)));
      loopCurve = K.polyline(loop.concat([loop[0]]));
      const res = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 1, 20), K.mat("#c9b48a")); res.rotation.z = Math.PI / 2; res.position.set(-1.6, 0.3, -2.5); g.add(res);
      ["#7a4a2a", "#2a8a3a", "#7a4a2a", "#d4a64a"].forEach((c, i) => {
        const b = new T.Mesh(new T.CylinderGeometry(0.175, 0.175, 0.07, 20), K.mat(c)); b.rotation.z = Math.PI / 2; b.position.set(-1.9 + i * 0.18, 0.3, -2.5); g.add(b);
      });
      led = new T.MeshStandardMaterial({ color: C("#7a1d18"), emissive: C("#ff3b2a"), emissiveIntensity: 0, transparent: true, opacity: 0.92, roughness: 0.25 });
      const body = new T.Mesh(new T.CylinderGeometry(0.22, 0.24, 0.42, 24), led); body.position.set(1.4, 0.42, -2.5);
      const dome = new T.Mesh(new T.SphereGeometry(0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), led); dome.position.set(1.4, 0.63, -2.5);
      ledLight = new T.PointLight(0xff3b2a, 0, 4); ledLight.position.set(1.4, 0.9, -2.5);
      g.add(body, dome, ledLight);
      const pkg = new T.Group(); pkg.position.set(4.0, 0, 0.3); g.add(pkg);
      const metal = K.mat("#c8d0d3", { metalness: 0.8, roughness: 0.3 });
      pkg.add(K.box(1.0, 1.3, 0.45, K.mat("#16191b", { roughness: 0.7 }), 0, 1.55, 0));
      pkg.add(K.box(1.0, 0.7, 0.13, K.mat("#b9c2c6", { metalness: 0.8, roughness: 0.3 }), 0, 2.55, -0.16));
      [-0.25, 0, 0.25].forEach((x) => pkg.add(K.box(0.08, 0.8, 0.05, metal, x, 0.55, 0)));
      const gbox = K.box(1.2, 0.5, 0.8, K.mat("#2b3a43"), 2.0, 0.25, 0.65); g.add(gbox, K.edges(gbox, "#4b6370"));
      knob = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.16, 24), K.mat("#d8a548", { metalness: 0.5, roughness: 0.4 })); knob.position.set(2.0, 0.58, 0.65); g.add(knob);
      knob.add(K.box(0.03, 0.02, 0.14, K.mat("#111"), 0, 0.09, 0.07));
      g.add(new T.Mesh(new T.TubeGeometry(K.polyline([V(2.6, .15, .5), V(3.75, .15, .5), V(3.75, .15, .3)]), 16, 0.035, 8, false), K.mat("#d8a548", { metalness: 0.4 })));
      g.add(new T.Mesh(new T.TubeGeometry(K.polyline([V(2.0, .15, 1.05), V(2.0, .15, 1.9)]), 8, 0.035, 8, false), wire));
      const j = new T.Mesh(new T.SphereGeometry(0.08, 12, 8), wire); j.position.set(2.0, 0.15, 1.9); g.add(j);
      dots = K.inst(new T.SphereGeometry(0.055, 10, 8), new T.MeshBasicMaterial({ color: C("#5fe1f5") }), N_DOTS); g.add(dots);
      ctx.label("電源 5 V", V(-4.4, 1.6, 0), ids, "strong");
      ctx.label("抵抗 150 Ω", V(-1.6, 0.75, -2.5), ids);
      ctx.label("LED", V(1.4, 1.05, -2.5), ids);
      ctx.label("MOSFET", V(4.0, 3.25, 0.3), ids, "strong");
      ctx.label("G D S", V(4.0, -0.25, 0.55), ids);
      ctx.label("ゲート電圧", V(2.0, 0.95, 0.65), ids, "g");
      ctx.label("電子の流れ →", V(0, 0.15, 2.35), ids, "e");
      return g;
    },
    update(ctx, S) {
      const r = P.ledCircuit(S.vgs), mA = r.id * 1000;
      return {
        goal: "LED を点ける", met: mA > 5,
        explain: S.vgs < P.VTH0
          ? "V_GS がしきい値(約 2 V)より低いので、MOSFET はオフ。LED には電流が流れません。"
          : mA < 15
            ? "しきい値を超えて電流が流れ始めました。V_GS を上げるほど、MOSFET を通れる電流が増えます。"
            : "MOSFET は完全にオン。電流は抵抗と LED で決まる約 20 mA で頭打ち。ゲートには電流がほぼ流れていません。",
        m: {
          vgs: [`${S.vgs.toFixed(2)}<small>V</small>`, "しきい値 2.0 V"],
          id: [`${mA.toFixed(1)}<small>mA</small>`, mA < 0.05 ? "消灯" : mA < 15 ? `点灯 ${Math.round(mA / 20 * 100)}%` : "全開(抵抗で約 20 mA に制限)"],
          ig: ["0<small>A</small>", "酸化膜で絶縁"],
        },
      };
    },
    frame(ctx, dt, S) {
      const r = P.ledCircuit(S.vgs), on = Math.min(1, r.id / 0.02);
      led.emissiveIntensity = on * 2.2; ledLight.intensity = on * 2.5;
      knob.rotation.y = -S.vgs / 5 * Math.PI * 1.5;
      const speed = r.id / 0.02 * 0.05;
      for (let i = 0; i < N_DOTS; i++) {
        phase[i] = (phase[i] + speed * dt) % 1;
        const p = loopCurve.getPointAt(phase[i]);
        K.put(dots, i, p.x, p.y, p.z, r.id > 1e-5 ? 1 : 0.7);
      }
      dots.instanceMatrix.needsUpdate = true;
    },
  };

  /* ===== II 中をのぞく(単位 mm) ===== */
  const dist = (z) => 45 * Math.pow(0.7 / 45, z);
  function widthMM(ctx, S) { return 2 * dist(S.zoom) * Math.tan(T.MathUtils.degToRad(ctx.camera.fov / 2)) * Math.max(ctx.camera.aspect, 0.5); }
  MOS.chapters.peek = {
    id: "peek", part: "A", title: "中をのぞく", scale: "パッケージの中",
    state: { zoom: 0 },
    prompt: "スライダーで拡大して、チップの表面まで近づこう。",
    controls: [{ type: "range", id: "zoom", label: "拡大", min: 0, max: 1, step: 0.005, fmt: (v) => `${Math.round(v * 100)}%` }],
    meters: [{ id: "w", k: "見えている幅" }],
    build(ctx) {
      const g = new T.Group(), ids = ["peek"];
      const plastic = new T.Mesh(new T.BoxGeometry(10, 9, 4.5), K.glass("#1c2328", 0.28)); plastic.renderOrder = 2;
      g.add(plastic, K.edges(plastic, "#5b7480", 0.7));
      const metal = K.mat("#b9c2c6", { metalness: 0.85, roughness: 0.28 });
      g.add(K.box(10, 15, 1.3, metal, 0, 3, -1.6));
      const hole = new T.Mesh(new T.CylinderGeometry(1.8, 1.8, 1.4, 32), K.mat("#0a1116")); hole.rotation.x = Math.PI / 2; hole.position.set(0, 7.5, -1.6); g.add(hole);
      [-2.54, 0, 2.54].forEach((x) => g.add(K.box(0.8, 13, 0.5, metal, x, -11, -0.6)));
      g.add(K.box(0.8, 2.6, 0.5, metal, 0, -5, -1.2));
      g.add(K.box(3.6, 3.6, 0.3, K.mat("#28324a", { metalness: 0.3, roughness: 0.35 }), 0, 0, -0.8));
      g.add(K.box(0.6, 0.6, 0.02, K.mat("#d0d6d8", { metalness: 0.9, roughness: 0.3 }), -1.3, -1.3, -0.64));
      g.add(K.box(2.2, 2.0, 0.02, K.mat("#9aa5aa", { metalness: 0.7, roughness: 0.4 }), 0.4, 0.3, -0.64));
      const gold = K.mat("#e1c06a", { metalness: 0.9, roughness: 0.25 });
      const bond = (a, b, h) => g.add(new T.Mesh(new T.TubeGeometry(new T.CubicBezierCurve3(a, V(a.x, a.y, a.z + h), V(b.x, b.y, b.z + h), b), 32, 0.06, 8, false), gold));
      bond(V(-1.3, -1.3, -0.63), V(-2.54, -4.2, -0.4), 1.2);
      bond(V(0.6, -0.2, -0.63), V(2.54, -4.2, -0.4), 1.4); bond(V(1.0, 0.4, -0.63), V(2.54, -4.0, -0.4), 1.6);
      const NC = 28, pitch = 1.9 / NC;
      const cells = K.inst(new T.BoxGeometry(pitch * 0.72, pitch * 0.72, 0.012), K.mat("#7fd3e6", { emissive: C("#1d6f80"), emissiveIntensity: 0.5, metalness: 0.2 }), NC * NC);
      let i = 0;
      for (let a = 0; a < NC; a++) for (let b = 0; b < NC; b++) K.put(cells, i++, -0.55 + (a + 0.5) * pitch, -0.65 + (b + 0.5) * pitch, -0.625);
      g.add(cells);
      ctx.label("樹脂(透明にしています)", V(0, 5.2, 2.3), ids);
      ctx.label("シリコンのチップ", V(-2.6, 2.3, -0.5), ids, "strong");
      ctx.label("金のワイヤー", V(-3.3, -3.0, 0.6), ids, "g");
      ctx.label("G", V(-2.54, -18.2, -0.6), ids); ctx.label("D", V(0, -18.2, -0.6), ids); ctx.label("S", V(2.54, -18.2, -0.6), ids);
      ctx.label("タブ = ドレイン", V(3.9, 9.3, -1.6), ids);
      return g;
    },
    camera(ctx, S) {
      const cam = ctx.camera, d = dist(S.zoom), target = V(0, 0, -0.6), sway = ctx.reduced || ctx.drag.down ? 0 : Math.sin(ctx.t * 0.25) * 0.05;
      const yaw = ctx.drag.yaw + sway, pitch = ctx.drag.pitch * (1 - S.zoom * 0.7) + 0.05;
      cam.position.set(target.x + Math.sin(yaw) * d, target.y + Math.sin(pitch) * d, target.z + Math.cos(yaw) * Math.cos(pitch) * d);
      cam.near = Math.max(0.01, d * 0.02); cam.updateProjectionMatrix(); cam.lookAt(target);
    },
    live: true,
    update(ctx, S) {
      const w = widthMM(ctx, S);
      return {
        goal: "表面まで寄る", met: S.zoom > 0.95, mag: 200 / w,
        explain: S.zoom < 0.35
          ? "黒い樹脂を透明にしました。中央の足(D)は裏の金属タブとつながり、G と S は金のワイヤーでチップに結ばれています。"
          : S.zoom < 0.8
            ? "数 mm 角のシリコンのチップ。これが MOSFET の本体です。"
            : "表面には同じ形の小さなセルがびっしり並び、すべて並列につながっています。ここでは数を減らして描いています(実物はセルの間隔が数 µm)。この先は、もっと小さな世界から順に見ていきます。",
        m: { w: [w >= 1 ? `${w.toFixed(w < 10 ? 1 : 0)}<small>mm</small>` : `${Math.round(w * 1000)}<small>µm</small>`, S.zoom < 0.35 ? "TO-220 パッケージ" : S.zoom < 0.8 ? "シリコンのチップ" : "チップ表面のセル"] },
      };
    },
  };
  MOS.pill = pill;
})();
