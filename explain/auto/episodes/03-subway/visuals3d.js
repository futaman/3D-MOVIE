/* 第 3 回「地下鉄ができるまで」の 3D の場面(段階型)。
   地面を z = 0 の面で切った断面のセットを全場面で使い回し、段階ごとに物を足す・削る。断面の手前(z > 0)に半分出した物で中を見せる。
   既製アセット: 人物 human01、空・外壁 assets/env、浜名湖 assets/hamanako、シールドマシン・セグメント・エスカレーター assets/subway。
   1 = 1 m。x = 横、y = 上、z = 手前。window.WORLD = { preload, init, update }。 */
(() => {
  "use strict";
  let g, T, ch, holder, sun, hemi, envSky, cur = "";
  const A = {}, sets = {}, W = {};
  const BASE = new URL("../../assets/", window.__VISUALS_URL).href;
  const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const tex = (f, srgb) => new Promise((ok, ng) => new THREE.TextureLoader().load(BASE + f, (t) => { if (srgb) t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; ok(t); }, undefined, () => ng(new Error("texture " + f))));
  const set = (name) => { const s = new T.Group(); s.visible = false; g.scene.add(s); sets[name] = s; return s; };
  function show(name) {
    if (cur === name) return; cur = name;
    for (const k in sets) sets[k].visible = k === name;
    g.scene.background = A.sky; g.scene.environment = envSky;
    g.scene.fog = name === "lake" ? new T.FogExp2(0xbccbdc, 0.000042) : new T.FogExp2(0xb9c9dc, 0.0022);
  }
  const SD = [0.35, 0.85, 0.4];
  function cam(pos, look, fov = 40, size = 30) {
    g.cam(pos, look, fov);
    sun.target.position.set(...look); sun.position.set(look[0] + SD[0] * size * 5, look[1] + SD[1] * size * 5, look[2] + SD[2] * size * 5);
    const c = sun.shadow.camera; c.left = c.bottom = -size; c.right = c.top = size; c.near = size; c.far = size * 12; c.updateProjectionMatrix();
  }
  const put = (parent, x, y, z, ry = 0) => { parent.add(holder); holder.position.set(x, y, z); holder.rotation.set(0, ry, 0); holder.visible = true; };
  const std = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: new T.Color(c).convertSRGBToLinear(), roughness: 0.9, metalness: 0, envMapIntensity: 0.6 }, o));
  const boxAt = (parent, w, h, d, x, y, z, m) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  // 下端 y0・上端 y1 の箱(高さを変えるのに使う)
  const setSpan = (b, y0, y1) => { const h = Math.max(1e-3, y1 - y0); b.scale.y = h; b.position.y = (y0 + y1) / 2; b.visible = y1 - y0 > 1e-3; };
  const spanBox = (parent, w, d, x, z, m) => { const b = new T.Mesh(new T.BoxGeometry(w, 1, d), m); b.position.set(x, 0, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };

  // 土の質感: 色むらと小石(断面の見た目。キャンバスで描く)
  function soilTex(base, seed, pebbles) {
    const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"), r = rng(seed), col = new T.Color(base);
    x.fillStyle = base; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2400; i++) { const k = 0.8 + r() * 0.35, cc = col.clone().multiplyScalar(k); x.fillStyle = `rgba(${cc.r * 255 | 0},${cc.g * 255 | 0},${cc.b * 255 | 0},0.35)`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 4 + r() * 22, 2 + r() * 6, 0, 0, 7); x.fill(); }
    for (let i = 0; i < pebbles; i++) { const v = 90 + r() * 90 | 0; x.fillStyle = `rgb(${v},${v - 6},${v - 14})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 2 + r() * 7, 1.5 + r() * 5, r() * 3, 0, 7); x.fill(); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
  }
  const soilMat = (base, seed, peb, rep = 8) => { const t = soilTex(base, seed, peb); t.repeat.set(rep, rep / 2); return new T.MeshStandardMaterial({ map: t, roughness: 1, envMapIntensity: 0.5 }); };

  /* ---- 断面のセット ---- */
  const X0 = -70, X1 = 70, ZB = -90, TR = 6.2, TD = 11;           // 断面の幅、奥行き、溝の半幅と深さ
  const LAYERS = [["盛土", 0, -2, "#7b6f62", 30], ["ローム", -2, -11, "#8a5a3c", 6], ["粘土", -11, -24, "#7c7a72", 4], ["砂", -24, -36, "#b59f78", 20], ["砂れき", -36, -52, "#8f8778", 160]];
  function buildCut() {
    const s = set("cut");
    const mats = LAYERS.map(([, , , c, p], i) => soilMat(c, 11 + i, p));
    W.lay = mats;
    LAYERS.forEach(([, y0, y1], i) => {
      if (y0 > -TD) { // 溝より浅い層は左右に分ける(溝の中は動かす)。川の場面では隠す
        W.upper = W.upper || [];
        W.upper.push(boxAt(s, TR + 0.0 - X0, y0 - y1, -ZB, (X0 - TR) / 2, (y0 + y1) / 2, ZB / 2, mats[i]));
        W.upper.push(boxAt(s, X1 - TR, y0 - y1, -ZB, (X1 + TR) / 2, (y0 + y1) / 2, ZB / 2, mats[i]));
      } else boxAt(s, X1 - X0, y0 - y1, -ZB, 0, (y0 + y1) / 2, ZB / 2, mats[i]);
    });
    // 溝の中: 掘る前の土(ローム)、埋め戻しの土(盛土)
    W.trenchSoil = spanBox(s, TR * 2, -ZB, 0, ZB / 2, mats[1]); W.backfill = spanBox(s, TR * 2, -ZB, 0, ZB / 2, mats[0]);
    W.trenchTop = spanBox(s, TR * 2, -ZB, 0, ZB / 2, mats[0]);
    // 鋼矢板(工事中だけ)
    W.piles = new T.Group(); s.add(W.piles); const pm = std("#3b3f45", { metalness: 0.6, roughness: 0.5 });
    for (const sx of [-1, 1]) boxAt(W.piles, 0.3, 15, -ZB, sx * (TR + 0.15), -6.5, ZB / 2, pm);
    // 開削の箱型トンネル(中は空洞。奥へ伸びる)
    W.box = new T.Group(); s.add(W.box); const con = std("#b8b4ab", { roughness: 0.92 });
    W.slab = boxAt(W.box, 11.4, 0.8, -ZB, 0, -10.6, ZB / 2, con);
    W.walls = [-5.35, 5.35, 0].map((x) => boxAt(W.box, x ? 0.7 : 0.5, 1, x ? -ZB : 0.5, x, 0, x ? ZB / 2 : 0, con));
    W.cols = []; for (let z = -1; z > ZB; z -= 5) W.cols.push(boxAt(W.box, 0.5, 1, 0.5, 0, 0, z, con));
    W.roof = boxAt(W.box, 11.4, 0.8, -ZB, 0, -3.9, ZB / 2, con);
    W.inside = boxAt(W.box, 10, 6.2, 0.05, 0, -7.25, ZB + 0.1, std("#202326"));
    // 道路と歩道、白線
    W.street = new T.Group(); s.add(W.street); const road = std("#2a2c30", { roughness: 0.95 }); boxAt(W.street, 16, 0.2, -ZB, 0, 0.1, ZB / 2, road);
    for (const sx of [-1, 1]) boxAt(W.street, 5, 0.35, -ZB, sx * 10.5, 0.17, ZB / 2, std("#8f8c86"));
    for (let z = -4; z > ZB; z -= 9) boxAt(W.street, 0.25, 0.22, 4, 0, 0.12, z, std("#e8e6df", { roughness: 0.6 }));
    // 両側の街(外壁の写真テクスチャ)
    const r = rng(303), dummy = new T.Object3D(), roof = std("#141619");
    [[A.f1, 0], [A.f6, 1]].forEach(([ft]) => { const t = ft.clone(); t.needsUpdate = true; t.repeat.set(1, 2);
      const m = new T.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.15, envMapIntensity: 0.7 }), im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), [m, m, roof, roof, m, m], 40); let k = 0;
      while (k < 40) { const sx = r() < 0.5 ? -1 : 1, x = sx * (16 + r() * 50), z = -6 - r() * 300, h = 15 + r() * 45, w = 12 + r() * 12; dummy.position.set(x, h / 2, z); dummy.scale.set(w, h, 12 + r() * 10); dummy.updateMatrix(); im.setMatrixAt(k++, dummy.matrix); }
      im.castShadow = im.receiveShadow = true; W.street.add(im); });
    // 配管(手前に向かって伸びる。切り口に丸が見える)
    W.pipes = [["#3d7fd1", 0.4, -3.7, -1.4, "水道"], ["#e1b52a", 0.3, -1.3, -1.0, "ガス"], ["#7a5a3a", 0.8, 1.3, -2.4, "下水"], ["#55595e", 0.45, 3.7, -1.1, "電線"]].map(([c, rr, x, y, name]) => {
      const p = new T.Mesh(new T.CylinderGeometry(rr, rr, -ZB, 28, 1, false).rotateX(Math.PI / 2), std(c, { roughness: 0.5, metalness: 0.2 })); p.position.set(x, y, ZB / 2 + 0.15); s.add(p);
      const hole = new T.Mesh(new T.CircleGeometry(rr * 0.82, 28), new T.MeshBasicMaterial({ color: 0x0b0b0c })); hole.position.set(x, y, 0.17); s.add(hole);
      return { p, hole, name, x, y, rr };
    });
    // 深いトンネル(切り口に見えるリング)。後から来るほど深い
    W.deep = [[-12, -17], [10, -28], [-2, -42]].map(([x, y]) => { const grp = new T.Group(); const ring = A.ring.clone(true); ring.rotation.y = Math.PI / 2; ring.position.z = 0; grp.add(ring);
      const hole = new T.Mesh(new T.CircleGeometry(3.1, 48), new T.MeshBasicMaterial({ color: 0x15171a })); hole.position.z = 0.02; grp.add(hole); grp.position.set(x, y, 0); s.add(grp); return grp; });
    // シールドのトンネル(x 方向に掘る。手前に半分出して中を見せる)
    W.tun = new T.Group(); W.tun.position.set(0, -24, 0); s.add(W.tun);
    W.shield = A.shield; W.tun.add(W.shield); W.cutter = W.shield.getObjectByName("cutter");
    W.rings = []; for (let i = 0; i < 70; i++) { const r2 = A.ring.clone(true); r2.visible = false; W.tun.add(r2); W.rings.push(r2); }
    // 川(テムズ川の場面)
    W.river = new T.Group(); s.add(W.river);
    boxAt(W.river, X1 - X0, TD, -ZB, 0, -TD / 2, ZB / 2, new T.MeshStandardMaterial({ color: new T.Color(0x1d3b44).convertSRGBToLinear(), roughness: 0.08, transparent: true, opacity: 0.88, envMapIntensity: 1.0 }));
    // 深い駅(六本木駅の模式図): 手前に置いたホームとエスカレーター、奥の壁
    W.st = new T.Group(); s.add(W.st); const wall = std("#a9a59c"), floor = std("#6f6b64");
    boxAt(W.st, 34, 46, 0.3, 0, -22.3, 0.12, wall);
    boxAt(W.st, 34, 0.6, 7, 0, -42.6, 3.5, floor); boxAt(W.st, 30, 1.2, 3, 0, -44.2, 5.2, std("#3e3b37"));
    W.esc = []; for (let k = 0; k < 4; k++) { const e = A.esc.clone(true); const run = A.escMeta.run_m; if (k % 2 === 0) { e.position.set(-run / 2, -42.3 + 10 * k, 2.2); } else { e.position.set(run / 2, -42.3 + 10 * k, 2.2); e.rotation.y = Math.PI; } W.st.add(e); W.esc.push(e);
      boxAt(W.st, 5, 0.4, 5, (k % 2 === 0 ? 1 : -1) * (run / 2 + 2.4), -42.3 + 10 * (k + 1) - 0.2, 2.6, floor); }
    W.ruler = new T.Group(); W.st.add(W.ruler); const rm = new T.MeshBasicMaterial({ color: 0xffffff });
    boxAt(W.ruler, 0.25, 42.3, 0.25, -12.5, -21.15, 1.5, rm); for (const y of [0, -42.3]) boxAt(W.ruler, 2, 0.25, 0.25, -12.5, y, 1.5, rm);
    // 14 階建てのビル(42.3 m)を地上に
    const ft = A.f1.clone(); ft.needsUpdate = true; ft.repeat.set(1, 3); const bm = new T.MeshStandardMaterial({ map: ft, roughness: 0.45, metalness: 0.15 });
    W.tower = boxAt(W.st, 14, 42.3, 14, 22, 21.15, -10, [bm, bm, roof, roof, bm, bm]);
  }
  function cutState(o) {
    // o: { dig 0..1, build 0..1, fill 0..1, pipes, deep: n, shield, river, station }
    const dig = o.dig ?? 1, build = o.build ?? 1, fill = o.fill ?? 1;
    // 溝の土: 掘る前は上まで。掘ると上から減る。箱ができたら埋め戻しが -3.5 から上へ
    setSpan(W.trenchSoil, -TD, Math.min(-2, -TD + (TD - 2) * (1 - dig)));
    setSpan(W.trenchTop, -2, dig > 0 ? -2 + 2 * (1 - Math.min(1, dig * 4)) : 0);
    if (dig >= 1 && fill > 0) { setSpan(W.backfill, -3.5, -3.5 + 3.5 * fill); } else W.backfill.visible = false;
    if (dig < 1) W.trenchTop.visible = W.trenchTop.visible && true;
    W.piles.visible = dig > 0 && fill < 1;
    const b = build; W.box.visible = dig >= 1 && b > 0;
    W.slab.scale.y = Math.min(1, b / 0.25); W.slab.position.y = -10.6;
    const wh = Math.max(0.001, Math.min(1, (b - 0.25) / 0.45)) * 6.2; W.walls.forEach((w) => { w.scale.y = wh; w.position.y = -10.2 + wh / 2; w.visible = b > 0.25; });
    W.cols.forEach((c) => { c.scale.y = wh; c.position.y = -10.2 + wh / 2; c.visible = b > 0.25; }); W.walls[2].visible = false;
    W.roof.visible = b > 0.7; W.roof.scale.x = Math.min(1, (b - 0.7) / 0.3 + 0.001); W.inside.visible = b > 0.7;
    W.pipes.forEach((p, i) => { const k = typeof o.pipes === "number" ? g.clamp(o.pipes * 4 - i) : o.pipes ? 1 : 0; p.p.visible = p.hole.visible = k > 0; p.p.scale.set(Math.max(k, 0.01), 1, Math.max(k, 0.01)); p.hole.scale.setScalar(Math.max(k, 0.01)); });
    W.deep.forEach((d, i) => { const k = g.clamp((o.deep || 0) - i); d.visible = k > 0; d.scale.setScalar(Math.max(0.01, g.out(k))); });
    W.tun.visible = !!o.shield; W.river.visible = !!o.river; W.st.visible = !!o.station; W.street.visible = !o.river; W.upper.forEach((b) => (b.visible = !o.river)); if (o.river) { W.box.visible = false; W.trenchSoil.visible = W.trenchTop.visible = W.backfill.visible = W.piles.visible = false; W.pipes.forEach((q) => (q.p.visible = q.hole.visible = false)); }
  }
  // シールドの位置(先端の x)と、組み終わったリングの数。erect = 今組んでいるリングの枚数(0..6)
  function shieldAt(front, erect = 6, spin = 0) {
    W.shield.position.set(front, 0, 0); W.cutter.rotation.x = spin;
    const tail = front - 9.0 + 1.0, n = Math.max(0, Math.floor((tail - (-60)) / 1.2));
    const nn = Math.min(n, W.rings.length); W.rings.forEach((r, i) => { r.visible = i < nn; if (i < n) { r.position.set(-60 + 0.6 + i * 1.2, 0, 0); r.children.forEach((c) => (c.visible = true)); } });
    if (nn > 0 && erect < 6) { const last = W.rings[nn - 1]; last.traverse((c) => { const m = /^seg_(\d)/.exec(c.name); if (m) c.visible = +m[1] < erect; }); }
  }

  window.WORLD = {
    async preload() {
      T = THREE;
      [A.sky, A.f1, A.f6] = await Promise.all([tex("env/sky_puresky_4k.jpg", true), tex("env/facade001_color.jpg", true), tex("env/facade006_color.jpg", true)]);
      A.sky.mapping = T.EquirectangularReflectionMapping; A.sky.wrapS = A.sky.wrapT = T.ClampToEdgeWrapping;
      ch = await AutoAssets.loadCharacter("human01");
      A.shield = await AutoAssets.loadModel("shield_machine", { receiveShadow: true }); A.ring = await AutoAssets.loadModel("segment_ring", { receiveShadow: true }); A.esc = await AutoAssets.loadModel("escalator", { receiveShadow: true });
      A.escMeta = window.AUTO_ASSET_DATA["escalator.meta"];
      A.hama = await AutoAssets.loadTerrain("hamanako", { coastZ: 9000 });
    },
    init(G) {
      g = G; T = g.T;
      const rd = g.renderer; rd.outputEncoding = T.sRGBEncoding; rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = 0.85;
      envSky = new T.PMREMGenerator(rd).fromEquirectangular(A.sky).texture;
      sun = new T.DirectionalLight(0xfff1dc, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; g.scene.add(sun, sun.target);
      hemi = new T.HemisphereLight(0xdfe8ff, 0x5a4a3a, 0.35); g.scene.add(hemi);
      holder = new T.Group(); holder.add(ch.root);
      buildCut();
      const lake = set("lake"); lake.add(A.hama.root);
    },
    update(id, p, t, dur) {
      const { ease, seg, out, screen, label } = g; holder.visible = false;
      if (id !== "s10") show("cut");
      if (id === "s1") { // 街から地面の切り口へ
        cutState({ dig: 0, build: 0, fill: 0 }); ch.play("walk", t); put(sets.cut, 10.5 - 0, 0.35, -3 - t * 1.3, Math.PI);
        const k = ease(seg(p, 0.05, 0.9)); cam(mix([18, 26, 52], [4, -9, 44], k), mix([0, 2, -30], [0, -16, 0], k), 40, 40);
      } else if (id === "s2") { // 1927 年の箱型トンネル(完成形)
        cutState({}); const k = ease(p); cam(mix([10, -2, 30], [5, -5, 24], k), [0, -7, 0], 40, 20);
        screen("1927年", 270, 150, { size: 48 }); if (p > 0.3) label("上野〜浅草 2.2km", [0, -3.2, 0], { size: 26, dy: -26, alpha: out(seg(p, 0.3, 0.4)) });
      } else if (id === "s3") { // 掘る → 作る → 埋め戻す
        const dg = seg(p, 0.05, 0.38), bd = seg(p, 0.4, 0.72), fl = seg(p, 0.76, 0.97);
        cutState({ dig: ease(dg), build: dg >= 1 ? ease(bd) : 0, fill: bd >= 1 ? ease(fl) : 0 });
        cam([3, -3, 34 - 4 * p], [0, -7, 0], 40, 20);
        screen(p < 0.39 ? "① 掘る" : p < 0.74 ? "② 箱を作る" : "③ 埋め戻す", 270, 150, { size: 44 });
      } else if (id === "s4") { // 街の下の配管
        cutState({ pipes: seg(p, 0.05, 0.7) }); cam([1, -0.6, 25 - 2 * p], [0, -2.6, 0], 40, 12);
        W.pipes.forEach((q, i) => { if (seg(p, 0.05, 0.7) * 4 - i > 0.6) label(q.name, [q.x, q.y + q.rr, 0.2], { size: 24, dy: -22 }); });
      } else if (id === "s5") { // シールドが進む。地上は無傷
        cutState({ pipes: true, shield: true }); const front = -20 + 22 * ease(p); shieldAt(front, 6, t * 1.2);
        ch.play("walk", t); put(sets.cut, -12 + t * 1.3, 0.35, -2, Math.PI / 2);
        const k = ease(p); cam(mix([front + 16, -12, 30], [front + 12, -17, 24], k), [front - 4, -20, 0], 42, 30);
      } else if (id === "s6") { // 後ろでセグメントを組む
        cutState({ pipes: true, shield: true }); const pp = p * 2 % 1, cyc = p < 0.5 ? 0 : 1;
        shieldAt(2 + 1.2 * cyc + 1.2 * ease(seg(pp, 0, 0.25)), Math.floor(seg(pp, 0.25, 0.95) * 6.99), t * 1.2);
        const k = ease(p); cam(mix([-11, -21, 11], [-15, -20, 12], k), [-6, -24, 0], 50, 14);
      } else if (id === "s7") { // テムズ川の下(1825〜1843)
        cutState({ shield: true, river: true }); shieldAt(-4 + 6 * ease(p), 6, t);
        cam([12 + 4 * p, -6, 52], [2, -13, 0], 40, 30);
        screen("1825年 ロンドン", 270, 300, { size: 40 }); if (p > 0.45) screen("完成まで 18年", 270, 355, { size: 36, alpha: out(seg(p, 0.45, 0.55)) });
        label("テムズ川", [0, -2, 0], { size: 30 });
      } else if (id === "s8") { // 後から来た路線ほど深い
        cutState({ pipes: true, deep: seg(p, 0.1, 0.85) * 3.2 }); const k = ease(p); cam(mix([0, -12, 50], [0, -22, 70], k), [0, -22, 0], 40, 40);
        label("古い", [0, -3.5, 0.5], { size: 28, dy: -24 }); if (p > 0.72) label("新しい", [-2, -38.4, 0.5], { size: 28, dy: -24, alpha: out(seg(p, 0.72, 0.82)) });
      } else if (id === "s9") { // 六本木駅 42.3 m
        cutState({ pipes: true, station: true });
        ch.play(p < 0.5 ? "idle" : "look_up", p < 0.5 ? t : (p - 0.5) * dur); put(W.st, -6, -42.3, 4.8, Math.PI * 0.2);
        const k = ease(seg(p, 0.1, 0.95)); cam(mix([-2, -39, 12], [5, -6, 105], k), mix([-5, -41, 0], [4, -2, 0], k), 40, 30 + 40 * k);
        if (p > 0.35) label("42.3m", [-12.5, -30, 1.5], { size: 32, dx: 46, alpha: out(seg(p, 0.35, 0.45)) });
        if (p > 0.6) label("14階ぶん", [22, 42.3, -3], { size: 28, dy: -22, alpha: out(seg(p, 0.6, 0.7)) });
      } else if (id === "s10") { // 浜名湖。静岡県に地下鉄はない
        show("lake"); const a = -0.25 + 0.3 * ease(p); cam([Math.sin(a) * 13000, 12500 - 1500 * p, 1500 + Math.cos(a) * 13000], [0, 0, -2500], 40, 30);
        label("浜名湖", [-1500, 0, -800], { size: 34 }); screen("静岡県の地下鉄 0路線", 270, 150, { size: 36 });
      }
    },
  };
})();
