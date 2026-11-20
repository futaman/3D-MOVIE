/* 第 6 回「エレベーターが落ちない仕組み」の 3D の場面(仕組み解説型)。
   既製アセット: エレベーターの断面 assets/elevator(昇降路・かご・釣合おもり・調速機・非常止め・緩衝器)、人物 human01、空 assets/env(映り込み用)。
   主索 4 本と調速機ロープは、かごと釣合おもりの位置から毎コマ JS で引く。1 = 1 m、+Y 上、+Z 手前(断面)。 */
(() => {
  "use strict";
  let g, T, ch, holder, sun, envSky, cur = "";
  const A = {}, W = {};
  const BASE = new URL("../../assets/", window.__VISUALS_URL).href;
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const tex = (f, srgb) => new Promise((ok, ng) => new THREE.TextureLoader().load(BASE + f, (t) => { if (srgb) t.encoding = THREE.sRGBEncoding; ok(t); }, undefined, () => ng(new Error("texture " + f))));
  let M;   // elevator.meta
  const ROPE_Z = [-0.12, -0.04, 0.04, 0.12];

  function beam(r, mat) { const m = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 10), mat); m.userData.r = r; return m; }
  function setBeam(m, a, b) { const A0 = new T.Vector3(...a), B0 = new T.Vector3(...b), d = B0.clone().sub(A0), L = d.length(); m.visible = L > 1e-4; if (!m.visible) return; m.position.copy(A0).add(B0).multiplyScalar(0.5); m.scale.set(m.userData.r, L, m.userData.r); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); }

  function build() {
    const s = new T.Group(); g.scene.add(s); W.set = s;
    W.el = A.el; s.add(W.el);
    W.car = W.el.getObjectByName("car"); W.cwt = W.el.getObjectByName("cwt"); W.sheave = W.el.getObjectByName("sheave"); W.gov = W.el.getObjectByName("gov_sheave");
    W.wl = W.el.getObjectByName("wedge_l"); W.wr = W.el.getObjectByName("wedge_r"); W.w0 = W.wl.position.y; [W.wl, W.wr].forEach((w) => { w.children.forEach((c) => (c.userData.sx = Math.sign(c.position.x))); w.scale.set(1, 1.3, 2.2); });
    W.dark = []; W.car.traverse((o) => { if (o.isMesh && o.material && o.material.name === "dark") { o.material = o.material.clone(); o.material.transparent = true; W.dark.push(o); } });
    // 主索: かご側の縦、釣合おもり側の縦、綱車の上の弧
    const rm = new T.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.35 });
    W.ropes = ROPE_Z.map((z) => {
      const carSide = beam(0.011, rm), cwSide = beam(0.011, rm), arc = new T.Mesh(new T.TorusGeometry(M.sheave.r_m, 0.011, 6, 48, Math.PI), rm);
      arc.position.set(M.sheave.x_m, M.sheave.y_m, z); s.add(carSide, cwSide, arc); return { z, carSide, cwSide, arc };
    });
    W.stub = ROPE_Z.map(() => { const a = beam(0.011, rm), b = beam(0.011, rm); s.add(a, b); return [a, b]; });
    // 調速機ロープ(輪)
    const gm = new T.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.6, roughness: 0.4 });
    W.govUp = beam(0.007, gm); W.govDn1 = beam(0.007, gm); W.govDn2 = beam(0.007, gm); s.add(W.govUp, W.govDn1, W.govDn2);
    W.govArc = new T.Mesh(new T.TorusGeometry(M.governor.r_m, 0.007, 6, 32, Math.PI), gm); W.govArc.position.set(M.governor.x_m, M.governor.y_m, 0); s.add(W.govArc);
    W.govArc2 = new T.Mesh(new T.TorusGeometry(M.governor.r_m, 0.007, 6, 32, Math.PI), gm); W.govArc2.rotation.z = Math.PI; W.govArc2.position.set(M.governor.x_m, M.governor.governor_pulley || M.governor.pulley_y_m, 0); s.add(W.govArc2);
    // かごの中の照明と人
    W.carLight = new T.PointLight(0xfff2dc, 0.9, 6, 2); W.car.add(W.carLight); W.carLight.position.set(0, 2.1, 0.2);
    holder = new T.Group(); holder.add(ch.root); W.car.add(holder); holder.position.set(-0.25, 0, 0.1); holder.rotation.y = 0.3;
    // 当時の実演(1850 年代): 木の台と、歯の付いた 2 本の柱(模式)
    const old = new T.Group(); W.old = old; old.visible = false; g.scene.add(old);
    const wood = new T.MeshStandardMaterial({ color: new T.Color(0x8a6239).convertSRGBToLinear(), roughness: 0.85 }), iron = new T.MeshStandardMaterial({ color: 0x2c2f33, metalness: 0.7, roughness: 0.5 });
    for (const sx of [-1.4, 1.4]) { const post = new T.Mesh(new T.BoxGeometry(0.25, 9, 0.3), wood); post.position.set(sx, 4.5, 0); old.add(post);
      for (let k = 0; k < 30; k++) { const tooth = new T.Mesh(new T.BoxGeometry(0.08, 0.16, 0.22), iron); tooth.position.set(sx - Math.sign(sx) * 0.15, 0.5 + k * 0.28, 0); tooth.rotation.z = Math.sign(sx) * 0.5; old.add(tooth); } }
    const beamTop = new T.Mesh(new T.BoxGeometry(3.4, 0.3, 0.35), wood); beamTop.position.set(0, 9.1, 0); old.add(beamTop);
    W.plat = new T.Group(); old.add(W.plat);
    const deck = new T.Mesh(new T.BoxGeometry(2.4, 0.12, 1.8), wood); W.plat.add(deck);
    const spring = new T.Mesh(new T.BoxGeometry(2.5, 0.1, 0.12), iron); spring.position.y = 2.2; W.plat.add(spring);
    for (const sx of [-1.15, 1.15]) { const pole = new T.Mesh(new T.BoxGeometry(0.08, 2.2, 0.08), iron); pole.position.set(sx, 1.1, 0); W.plat.add(pole); }
    W.oldRope = beam(0.02, new T.MeshStandardMaterial({ color: 0xb59b6a, roughness: 0.9 })); old.add(W.oldRope);
    const floorOld = new T.Mesh(new T.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: new T.Color(0x6b5a48).convertSRGBToLinear(), roughness: 1 })); old.add(floorOld);
    W.old.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // かごの床の高さ yc、釣合おもりの中心 yw、ロープが切れているか cut、非常止めのくさび k(0..1)
  const L = 21.6;
  function state(o) {
    const yc = o.yc, hitch = yc + M.car.hitch_y_m, S = M.sheave, cut = !!o.cut;
    W.car.position.y = yc;
    const yw = o.yw !== undefined ? o.yw : S.y_m - (L - (S.y_m - hitch)) - M.cwt.height_m / 2 - 0.12;
    W.cwt.position.set(M.cwt.x_m, yw, 0);
    const cwTop = yw + M.cwt.height_m / 2 + 0.12;
    W.ropes.forEach((r, i) => {
      r.arc.visible = true;
      if (!cut) { setBeam(r.carSide, [r.z * 0.6, hitch, r.z], [0, S.y_m, r.z]); setBeam(r.cwSide, [S.x_m * 2, S.y_m, r.z], [M.cwt.x_m, cwTop, r.z]); W.stub[i].forEach((b) => (b.visible = false)); }
      else { r.carSide.visible = false; setBeam(r.cwSide, [S.x_m * 2, S.y_m, r.z], [M.cwt.x_m, cwTop, r.z]);
        const dang = 1.6 + 0.3 * i, sw = (o.whip || 0) * Math.sin(i * 1.7 + (o.t || 0) * 9); setBeam(W.stub[i][0], [0, S.y_m, r.z], [0.05 * i + 0.4 * sw, S.y_m - dang, r.z]); setBeam(W.stub[i][1], [r.z * 0.6, hitch, r.z], [r.z * 0.6 + 0.3 * sw, hitch + 1.2 + 0.25 * i, r.z + 0.2 * sw]); }
    });
    // 調速機ロープ: 上り側 x = gx - r、下り側 x = gx + r(かごのレバーにつながる)
    const G = M.governor, xl = G.x_m - G.r_m, xr = G.x_m + G.r_m, lever = yc - 0.12;
    setBeam(W.govUp, [xl, G.pulley_y_m, 0], [xl, G.y_m, 0]); setBeam(W.govDn1, [xr, G.y_m, 0], [xr, lever, 0]); setBeam(W.govDn2, [xr, lever, 0], [xr, G.pulley_y_m, 0]);
    W.govArc2.position.set(G.x_m, G.pulley_y_m, 0);
    W.sheave.rotation.z = -(hitch) / S.r_m * (cut ? 0 : 1) + (o.sheaveFreeze || 0); W.gov.rotation.z = -yc / G.r_m;
    const k = o.wedge || 0; for (const w of [W.wl, W.wr]) { w.position.y = W.w0 + 0.12 * k; w.children.forEach((c) => (c.position.x = c.userData.sx * (0.045 - 0.027 * k))); }
    W.dark.forEach((m) => { m.material.opacity = o.ghost ? 0.18 : 1; m.material.depthWrite = !o.ghost; });
  }

  window.WORLD = {
    async preload() {
      T = THREE;
      A.sky = await tex("env/sky_puresky_4k.jpg", true); A.sky.mapping = T.EquirectangularReflectionMapping;
      A.el = await AutoAssets.loadModel("elevator", { receiveShadow: true }); M = window.AUTO_ASSET_DATA["elevator.meta"];
      ch = await AutoAssets.loadCharacter("human01");
    },
    init(G) {
      g = G; T = g.T;
      const rd = g.renderer; rd.outputEncoding = T.sRGBEncoding; rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = 0.95;
      envSky = new T.PMREMGenerator(rd).fromEquirectangular(A.sky).texture; g.scene.environment = envSky;
      const bg = document.createElement("canvas"); bg.width = 2; bg.height = 256; const x = bg.getContext("2d"), gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#2a2f38"); gr.addColorStop(1, "#0d0f12"); x.fillStyle = gr; x.fillRect(0, 0, 2, 256);
      const bt = new T.CanvasTexture(bg); bt.encoding = T.sRGBEncoding; g.scene.background = bt;
      sun = new T.DirectionalLight(0xfff1dc, 1.2); sun.position.set(6, 30, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; g.scene.add(sun, sun.target);
      Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix();
      g.scene.add(new T.HemisphereLight(0xdfe8ff, 0x3a3530, 0.45));
      const fill = new T.DirectionalLight(0xbcd0ff, 0.5); fill.position.set(-8, 10, 12); g.scene.add(fill);
      build();
    },
    update(id, p, t, dur) {
      const { ease, seg, out, screen, label } = g;
      const isOld = id === "s7" || id === "s8"; W.set.visible = !isOld; W.old.visible = isOld; g.scene.environment = envSky;
      const sh = (y) => { sun.target.position.set(0.5, y, 0); sun.position.set(6, y + 20, 18); };
      if (id === "s1") { // 上っている途中で全部切れる → 少し落ちて止まる
        const tc = seg(p, 0.0, 0.35), cutAt = 0.35, yUp = 4 + 3 * ease(tc);
        let yc = yUp, wedge = 0; const cut = p > cutAt;
        if (cut) { const f = (p - cutAt) * dur; const drop = Math.min(0.9, 3.0 * f * f); yc = yUp - drop; wedge = g.clamp((f - 0.45) / 0.15); }
        state({ yc, cut, wedge, whip: cut ? Math.max(0, 1 - (p - cutAt) * 2.5) : 0, t }); ch.play(cut ? "look_up" : "idle", cut ? (p - cutAt) * dur : t);
        const k = ease(seg(p, 0, 0.35)), shake = cut ? 0.06 * Math.sin(t * 60) * Math.max(0, 1 - (p - cutAt) * 4) : 0; g.cam(mix([4.5, 9, 18], [2.6, yUp + 2.4, 7.5], k).map((v, i) => v + (i === 0 ? shake : 0)), mix([0.4, 8, 0], [0.3, yUp + 2.2, 0], k), 40); sh(yc);
        if (cut && p < 0.8) screen("全部切れた", 270, 160, { size: 44, color: "#ff6a5a" }); if (p > 0.75) screen("止まった", 270, 220, { size: 40, alpha: out(seg(p, 0.75, 0.85)) });
      } else if (id === "s2") { // 主索は 3 本以上(ここでは 4 本)
        state({ yc: 3.5 + 1.0 * ease(p) });
        const k = ease(p); g.cam(mix([0.9, 21.2, 5.2], [1.1, 20.6, 6.4], k), [0.9, 21.9, 0], 40); sh(21);
        label("主索 4本", [0, 20.4, 0.15], { size: 30, dx: 56 }); if (p > 0.45) screen("満員の 10倍以上に耐える", 270, 160, { size: 36, alpha: out(seg(p, 0.45, 0.55)) });
      } else if (id === "s3") { // 釣合おもり
        const yc = 2 + 9 * ease(p); state({ yc }); const yw = W.cwt.position.y;
        g.cam([4.6, yw - 0.6, 10], [1.2, yw - 1.4, 0], 40); sh(yw);
        label("釣り合いおもり", [M.cwt.x_m, yw + 1.6, 0.2], { size: 28, dy: -24 }); if (p > 0.4) label("かご", [0, yc + 2.6, 0.5], { size: 28, dy: -10, alpha: out(seg(p, 0.4, 0.5)) });
      } else if (id === "s4") { // 全部切れて、落ち始める。調速機が回り出す
        const f = p * dur, y0 = 14, yc = Math.max(5, y0 - 0.9 * f * f); state({ yc, cut: true });
        ch.play("look_up", f);
        g.cam([2.6, 14.5, 28], [0.4, 14.2, 0], 42); sh(15);
        label("調速機", [M.governor.x_m, M.governor.y_m + 0.35, 0.2], { size: 30, dy: -26 }); label("かご", [0, yc + 2.6, 0.5], { size: 26, dy: -12 });
      } else if (id === "s5") { // 調速機が速さを見張る(1.3 倍の前に動力を切る)
        const yc = 6 - 3 * p; state({ yc, cut: true });
        g.cam([0.6, M.governor.y_m + 0.2, 3.6], [M.governor.x_m, M.governor.y_m - 0.2, 0], 40); sh(M.governor.y_m);
        label("調速機", [M.governor.x_m, M.governor.y_m + 0.3, 0.1], { size: 30, dx: 80 });
        const v = Math.min(1.3, 1.0 + 0.4 * ease(seg(p, 0.1, 0.7))); screen(`速さ ${v.toFixed(1)}倍`, 270, 160, { size: 46, color: v >= 1.29 ? "#ffb04a" : "#ffffff" });
        if (p > 0.72) screen("モーター停止", 270, 220, { size: 36, alpha: out(seg(p, 0.72, 0.8)) });
      } else if (id === "s6") { // 非常止めがレールを挟む
        const f = seg(p, 0.15, 0.55), stop = 3.0, yc = stop + 1.0 * (1 - ease(f)); state({ yc, cut: true, wedge: ease(seg(p, 0.2, 0.6)), ghost: true });
        ch.play("shake_head", seg(p, 0.5, 1) * 1.2);
        const rx = -(M.rail_x_m - 0.035); g.cam([rx + 0.08, yc - 0.24, 1.05], [rx + 0.02, yc - 0.26, 0], 40); sh(yc);
        if (p > 0.3) label("くさび", [rx - 0.03, yc - 0.3 + 0.12 * ease(seg(p, 0.2, 0.6)), 0.08], { size: 30, dx: -90, alpha: out(seg(p, 0.3, 0.4)) });
        if (p > 0.45) label("レール", [rx, yc + 0.05, 0], { size: 28, dx: -80, alpha: out(seg(p, 0.45, 0.55)) });
        if (p > 0.6) screen("1.4倍の前に 停止", 270, 160, { size: 40, alpha: out(seg(p, 0.6, 0.7)) });
      } else if (isOld) { // 1850 年代の実演
        const y = 6.5; holder.visible = true; W.plat.add(holder); holder.position.set(0, 0.06, 0.2); holder.rotation.y = 0;
        let py = y, cut = false;
        if (id === "s8") { cut = true; const f = p * dur; py = y - Math.min(0.08, 0.5 * f * f); }
        else { cut = p > 0.8; if (cut) py = y - 0.02; }
        W.plat.position.set(0, py, 0); setBeam(W.oldRope, [0, py + 2.2, 0], [0, cut ? py + 3.0 : 9.0, 0]);
        ch.play(id === "s8" ? "wave" : "idle", t);
        g.cam(id === "s7" ? mix([7, 3, 14], [4, 6, 9], ease(p)) : [3.8, py + 1.4, 6.5], [0.6, py + 0.8, 0], 40);
        sun.target.position.set(0, 5, 0); sun.position.set(6, 25, 18);
        if (id === "s7") screen("1850年代 ニューヨーク(模式)", 270, 160, { size: 34 });
        if (id === "s8" && p > 0.35) screen("落ちたのは 数センチ", 270, 160, { size: 40, alpha: out(seg(p, 0.35, 0.45)) });
      } else if (id === "s9") { // 最後の保険: 緩衝器
        W.car.add(holder); holder.position.set(-0.25, 0, 0.1); holder.rotation.y = 0.3;
        const yc = 0.4 - 0.72 * ease(seg(p, 0.1, 0.6)); state({ yc, cut: true });
        ch.play("idle", t); g.cam([1.9, -0.9, 3.6], [0, -0.6, 0], 44); sun.target.position.set(0, -1, 0); sun.position.set(6, 19, 18);
        if (p > 0.3) label("緩衝器", [0.45, -0.75, 0.2], { size: 30, dx: 70, dy: -40, alpha: out(seg(p, 0.3, 0.4)) });
      } else if (id === "s10") { // 吊るす係はロープ。止める係は 3 つ(順にアップ)
        W.car.add(holder); holder.position.set(-0.25, 0, 0.1); holder.rotation.y = 0.3; ch.play("wave", t);
        const part = p < 0.28 ? 0 : p < 0.52 ? 1 : p < 0.76 ? 2 : 3;
        if (part === 0) { state({ yc: 8 }); g.cam([1.0, 20.8, 4.8], [0.6, 21.6, 0], 40); sun.target.position.set(0.5, 21, 0); sun.position.set(6, 40, 18); label("ロープ", [0, 20.2, 0.15], { size: 30, dx: 60 }); }
        else if (part === 1) { state({ yc: 8, cut: true }); g.cam([0.5, M.governor.y_m - 0.2, 3.2], [M.governor.x_m, M.governor.y_m - 0.3, 0], 40); label("① 調速機", [M.governor.x_m, M.governor.y_m + 0.35, 0.1], { size: 32, dy: -30 }); }
        else if (part === 2) { state({ yc: 3, cut: true, wedge: 1, ghost: true }); const rx = -(M.rail_x_m - 0.035); g.cam([rx + 0.08, 2.76, 1.05], [rx + 0.02, 2.74, 0], 40); sun.target.position.set(0, 3, 0); sun.position.set(6, 22, 18); label("② 非常止め", [rx, 2.95, 0.08], { size: 32, dx: -90 }); }
        else { state({ yc: -0.35, cut: true }); g.cam([1.9, -0.9, 3.6], [0, -0.6, 0], 44); sun.target.position.set(0, -1, 0); sun.position.set(6, 19, 18); label("③ 緩衝器", [0.45, -0.75, 0.2], { size: 32, dx: 70, dy: -40 }); }
        screen(part === 0 ? "吊るす係" : "止める係", 270, 160, { size: 44 });
      }
    },
  };
})();
