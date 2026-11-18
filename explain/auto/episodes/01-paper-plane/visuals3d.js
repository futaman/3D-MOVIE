/* 第 1 回「紙飛行機」の 3D の場面。window.WORLD = { init(g), update(sceneId, p, t, dur) }
   動きはすべて (場面, p, t) だけで決まる(乱数は種を固定)。大きさは見やすさのために誇張している。 */
(() => {
  "use strict";
  let g, T, sets = {}, ch, plane, trail, W = {};
  const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const mats = {};
  const M = (c, o) => { const k = c + JSON.stringify(o || ""); return mats[k] || (mats[k] = new T.MeshStandardMaterial(Object.assign({ color: new T.Color(c), roughness: 0.9, metalness: 0, flatShading: true }, o || {}))); };
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (parent, w, h, d, c, x, y, z) => add(parent, new T.BoxGeometry(w, h, d), M(c), x, y, z);
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const UP = () => V(0, 1, 0);
  const setBeam = (m, a, b, r) => { const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length() || 1e-6; m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); m.scale.set(r, len, r); m.quaternion.setFromUnitVectors(UP(), d.normalize()); };
  const beam = (parent, a, b, r, c) => { const m = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 6), new T.MeshBasicMaterial({ color: new T.Color(c) })); setBeam(m, a, b, r); parent.add(m); return m; };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const set = (name) => { const s = new T.Group(); s.visible = false; g.scene.add(s); sets[name] = s; return s; };
  const skies = {};
  const skyTex = (top, bottom) => { const k = top + bottom; if (skies[k]) return skies[k]; const c = document.createElement("canvas"); c.width = 2; c.height = 256; const x = c.getContext("2d"), gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(0.62, bottom); gr.addColorStop(1, bottom); x.fillStyle = gr; x.fillRect(0, 0, 2, 256); return (skies[k] = new T.CanvasTexture(c)); };
  const show = (name, sky, near, far, top) => { for (const k in sets) sets[k].visible = k === name; g.scene.background = top ? skyTex(top, sky) : new T.Color(sky); g.scene.fog = far ? new T.Fog(new T.Color(sky), near, far) : null; };
  // カメラを置き、注視点のまわりに影の範囲を合わせる
  const cam = (pos, look, fov = 40, size) => { g.cam(pos, look, fov); const d = size || Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) * 0.8, c = W.sun.shadow.camera;
    W.sun.target.position.set(...look); W.sun.position.set(look[0] - d * 1.2, look[1] + d * 2.4, look[2] + d * 1.7); c.left = c.bottom = -d; c.right = c.top = d; c.near = d * 0.2; c.far = d * 7; c.updateProjectionMatrix(); W.sun.shadow.normalBias = d * 0.004; };
  const waterTex = () => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), r = rng(9); x.fillStyle = "#3a8ccc"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) { x.fillStyle = r() < 0.5 ? "rgba(255,255,255,.16)" : "rgba(20,70,130,.2)"; x.beginPath(); x.ellipse(r() * 256, r() * 256, 10 + r() * 26, 1.5 + r() * 2.5, 0, 0, 7); x.fill(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
  const cloud = (parent, x, y, z, s, seed = 1) => { const r = rng(seed * 97 + 3), c = new T.Group(); for (let i = 0; i < 4; i++) { const m = add(c, new T.SphereGeometry(1, 8, 6), M("#ffffff", { emissive: new T.Color("#9fb4c8"), flatShading: false }), (i - 1.5) * 1.1 + r() * 0.4, r() * 0.4, r() * 0.8); m.scale.set(1 + r() * 0.5, 0.55 + r() * 0.25, 0.9 + r() * 0.4); } c.position.set(x, y, z); c.scale.setScalar(s); parent.add(c); return c; };
  const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

  /* ---- 固定キャラクター「計算係」(白衣・青緑の帽子・めがね)。正面は +x ---- */
  function makeChar() {
    const root = new T.Group(), b = new T.Group(); b.rotation.y = Math.PI / 2; root.add(b);
    for (const sx of [-1, 1]) { box(b, 0.2, 0.7, 0.24, "#2c3550", sx * 0.14, 0.35, 0); box(b, 0.22, 0.1, 0.36, "#1b1f2b", sx * 0.14, 0.05, 0.05); }
    box(b, 0.62, 0.95, 0.38, "#f7f7f2", 0, 1.1, 0); box(b, 0.14, 0.5, 0.02, "#17a89a", 0, 1.3, 0.2);
    const head = new T.Group(); head.position.set(0, 1.9, 0); b.add(head);
    add(head, new T.SphereGeometry(0.3, 14, 10), M("#f2c9a0", { flatShading: false }));
    add(head, new T.SphereGeometry(0.315, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M("#17a89a", { flatShading: false }), 0, 0.04, 0);
    box(head, 0.38, 0.04, 0.24, "#12867b", 0, 0.08, 0.36);
    for (const sx of [-1, 1]) add(head, new T.TorusGeometry(0.085, 0.022, 6, 14), M("#20242e"), sx * 0.115, -0.03, 0.275);
    box(head, 0.08, 0.02, 0.02, "#20242e", 0, -0.03, 0.29);
    const helmet = add(head, new T.SphereGeometry(0.46, 16, 12), new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false })); helmet.visible = false;
    const arm = (sx) => { const p = new T.Group(); p.position.set(sx * 0.39, 1.5, 0); b.add(p); box(p, 0.15, 0.62, 0.15, "#f7f7f2", 0, -0.31, 0); const h = add(p, new T.SphereGeometry(0.09, 8, 6), M("#f2c9a0"), 0, -0.68, 0); return { p, h }; };
    const R = arm(-1), L = arm(1); L.p.rotation.z = 0.12;
    return { root, head, helmet, armR: R.p, hand: R.h, armL: L.p };
  }
  function makePlane() {
    const geo = new T.BufferGeometry(), v = [0, 0, 1, 0, 0, -0.6, -0.5, 0.06, -0.6, 0, 0, 1, 0.5, 0.06, -0.6, 0, 0, -0.6, 0, 0, 1, 0, -0.2, -0.6, 0, 0, -0.6];
    geo.setAttribute("position", new T.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    const grp = new T.Group(); grp.add(new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8c8c8c, side: T.DoubleSide, flatShading: true, roughness: 1 })));
    grp.add(new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: 0x33415a })));
    return grp;
  }
  // 投げる動き。u<0 構える / 0〜0.6 振りかぶる / 0.6〜1 振り下ろす。0.8 で手を離れる
  function pose(u) {
    const a = u <= 0 ? -1.15 : u < 0.6 ? g.lerp(-1.15, -3.7, g.ease(u / 0.6)) : g.lerp(-3.7, -0.8, g.out((u - 0.6) / 0.4));
    ch.armR.rotation.set(a, 0, 0); ch.root.rotation.z = u <= 0 ? 0 : u < 0.6 ? 0.16 * g.ease(u / 0.6) : g.lerp(0.16, -0.18, g.out((u - 0.6) / 0.4));
    return u >= 0.8;
  }
  const place = (x, y, z, s, ry = 0) => { ch.root.position.set(x, y, z); ch.root.scale.setScalar(s); ch.root.rotation.set(0, ry, 0); ch.head.rotation.set(0, 0, 0); ch.armL.rotation.set(0, 0, 0.12); ch.helmet.visible = false; ch.root.visible = true; };
  const hv = new (window.THREE.Vector3)();
  const handPos = () => { ch.root.updateMatrixWorld(true); ch.hand.getWorldPosition(hv); return [hv.x, hv.y, hv.z]; };
  const fly = (pos, dir, s) => { plane.visible = true; plane.position.set(...pos); plane.scale.setScalar(s); plane.lookAt(pos[0] + dir[0], pos[1] + dir[1], pos[2] + dir[2]); };
  const inHand = (s, dir = [1, 0.1, 0]) => { const h = handPos(); fly([h[0], h[1] + 0.25 * s, h[2]], dir, s); return h; };
  const trailTo = (a, b, r) => { trail.visible = true; setBeam(trail, a, b, r); };

  /* ---- A: 東京タワーと街(1 = 10 m) ---- */
  function buildCity() {
    const s = set("city");
    add(s, new T.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), M("#93a88f"));
    box(s, 300, 0.06, 6, "#5d646d", 100, 0.03, 0);
    for (let i = 0; i < 24; i++) box(s, 3, 0.07, 0.25, "#e9e9e0", -40 + i * 12, 0.04, 0);
    const r = rng(7), n = 900, im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), M("#ffffff"), n), d = new T.Object3D(), col = new T.Color(); let k = 0;
    while (k < n) { const x = -120 + r() * 480, z = -170 + r() * 320; const w = 2 + r() * 4, dd = 2 + r() * 4, h = 1 + r() * r() * 11 + (r() < 0.05 ? 8 : 0);
      if (Math.abs(z) < 5.5 || x * x + z * z < 150 || (Math.abs(x - 148) < 7 && Math.abs(z + 16) < 7)) continue;
      d.position.set(x, h / 2, z); d.scale.set(w, h, dd); d.updateMatrix(); im.setMatrixAt(k, d.matrix); col.setHSL(0.58, 0.05 + r() * 0.08, 0.62 + r() * 0.25); im.setColorAt(k, col); k++; }
    im.frustumCulled = false; s.add(im);
    // 東京タワー: 高さ 33.3
    const prof = [[0, 7.5], [10, 3.8], [15, 2.9], [25, 1.5], [33.3, 0.22]], rad = (y) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][0]) { const [y0, r0] = prof[i - 1], [y1, r1] = prof[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0.2; };
    const bands = [[0, 10, "#ef5a2c"], [11.5, 15, "#f4f1ea"], [15, 19, "#ef5a2c"], [19, 22, "#f4f1ea"], [22, 25, "#ef5a2c"], [26, 29, "#f4f1ea"], [29, 31.5, "#ef5a2c"], [31.5, 33.3, "#f4f1ea"]];
    for (const [y0, y1, c] of bands) { const m = add(s, new T.CylinderGeometry(rad(y1), rad(y0), y1 - y0, 4), M(c), 0, (y0 + y1) / 2, 0); m.rotation.y = Math.PI / 4; }
    box(s, 6.4, 1.5, 6.4, "#dfe3e6", 0, 10.75, 0); box(s, 2.6, 1, 2.6, "#dfe3e6", 0, 25.5, 0);
    add(s, new T.CylinderGeometry(1, 1, 0.16, 12), M("#8b929b"), 0, 33.3, 0);
    // 六本木ヒルズ(高さ 23.8)
    add(s, new T.CylinderGeometry(3.4, 3.8, 23.8, 10), M("#6f93bd"), 148, 11.9, -16); add(s, new T.CylinderGeometry(2.2, 3.4, 1.2, 10), M("#587ba3"), 148, 24.4, -16);
    for (let i = 0; i < 9; i++) cloud(s, -150 + i * 70 + (i % 3) * 20, 62 + (i % 4) * 9, -160 - (i % 3) * 60, 9 + (i % 3) * 3, i + 1);
    // 寸法線と 1:6 の三角形
    const dim = new T.Group(); s.add(dim); beam(dim, [-9.5, 0, 0], [-9.5, 33.3, 0], 0.16, "#ffd84a"); beam(dim, [-11, 0, 0], [-8, 0, 0], 0.16, "#ffd84a"); beam(dim, [-11, 33.3, 0], [-8, 33.3, 0], 0.16, "#ffd84a");
    const tri = new T.Group(); s.add(tri); beam(tri, [0.9, 34.6, 0], [5.7, 34.6, 0], 0.03, "#ffd84a"); beam(tri, [5.7, 34.6, 0], [5.7, 33.8, 0], 0.03, "#ffd84a"); beam(tri, [0.9, 34.6, 0], [5.7, 33.8, 0], 0.02, "#ffffff"); W.ghost = makePlane(); tri.add(W.ghost);
    W.dim = dim; W.tri = tri;
  }
  const TOP = [0, 33.38, 0], CS = 0.75;
  const cityPath = (f, rel) => { const x = rel[0] + (200 - rel[0]) * f; return [x, Math.max(0.25, 33.3 - x / 6 + (rel[1] - 33.3 + rel[0] / 6) * Math.exp(-(x - rel[0]) / 10)), 0]; };

  /* ---- B: 富士山(1 = 100 m) ---- */
  function fujiMesh(parent) {
    const P = [[90, 0], [55, 6], [34, 14], [20, 22], [13.6, 27], [11, 29], [5.5, 35], [3.2, 37.76], [0, 37.5]], grp = new T.Group();
    const part = (a, b, c) => add(grp, new T.LatheGeometry(P.slice(a, b + 1).map(([r, y]) => new T.Vector2(r, y)), 20), M(c));
    part(0, 2, "#4f8560"); part(2, 4, "#5f7ba8"); part(4, 8, "#fbfdff"); parent.add(grp); return grp;
  }
  function buildFuji() {
    const s = set("fuji"); add(s, new T.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), M("#86b47c")); fujiMesh(s);
    const r = rng(21); for (let i = 0; i < 26; i++) { const a = r() * 6.28, R = 70 + r() * 260; cloud(s, Math.cos(a) * R + 80, 9 + r() * 12, Math.sin(a) * R, 6 + r() * 7, i + 30); }
    const im = new T.InstancedMesh(new T.ConeGeometry(1, 1, 5), M("#6f9d70"), 40), d = new T.Object3D();
    for (let i = 0; i < 40; i++) { const x = 60 + r() * 500, z = (r() - 0.5) * 500; const h = 3 + r() * 7; if (Math.abs(z) < 40) { d.scale.set(0.001, 0.001, 0.001); } else d.scale.set(14 + r() * 16, h, 14 + r() * 16); d.position.set(x, h / 2, z); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } s.add(im);
    W.ring = add(s, new T.RingGeometry(3, 4.2, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffd84a }), 226.6, 0.3, 0);
  }

  /* ---- C: 旅客機の上(1 = 1 m くらい) ---- */
  function buildJet() {
    const s = set("jet"), j = new T.Group(); s.add(j); const body = M("#f4f6f8", { flatShading: false });
    add(j, new T.CylinderGeometry(2.2, 2.2, 36, 14).rotateZ(Math.PI / 2), body);
    add(j, new T.SphereGeometry(2.2, 14, 10), body, 18, 0, 0).scale.set(2.4, 1, 1);
    add(j, new T.CylinderGeometry(2.2, 0.7, 10, 14).rotateZ(Math.PI / 2), body, -23, 0.6, 0);
    for (const sz of [-1, 1]) { const w = box(j, 6.5, 0.35, 17, "#e3e8ee", -2, -0.9, sz * 10.2); w.rotation.y = sz * 0.42; add(j, new T.CylinderGeometry(1.05, 1.05, 4.6, 10).rotateZ(Math.PI / 2), M("#c9d1da"), 1.5, -2.2, sz * 7.5); box(j, 30, 0.45, 0.06, "#27344d", 2, 0.55, sz * 2.14); const tp = box(j, 3.6, 0.28, 6, "#e3e8ee", -25.5, 1, sz * 3.4); tp.rotation.y = sz * 0.4; }
    const fin = box(j, 5.5, 6.5, 0.4, "#17a89a", -25, 4.4, 0); fin.rotation.z = 0.35;
    const r = rng(5), n = 150, im = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), M("#ffffff", { emissive: new T.Color("#a9bdd2"), flatShading: false }), n); im.frustumCulled = false; s.add(im);
    W.jetClouds = { im, d: Array.from({ length: n }, () => [r() * 700, -90 + r() * 40, -380 + r() * 420, 14 + r() * 22]) };
  }

  /* ---- D: 成層圏の気球 ---- */
  function buildStrat() {
    const s = set("strat");
    add(s, new T.SphereGeometry(200, 64, 40), M("#2a6fc4", { flatShading: false }), 0, -240, 0);
    add(s, new T.SphereGeometry(203.5, 64, 40), new T.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.28, depthWrite: false }), 0, -240, 0);
    const r = rng(11), n = 260, im = new T.InstancedMesh(new T.SphereGeometry(1, 7, 5), new T.MeshBasicMaterial({ color: 0xf4f8fc }), n), d = new T.Object3D();
    for (let i = 0; i < n; i++) { const th = r() * 1.1, ph = r() * 6.28, nrm = V(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); d.position.copy(nrm).multiplyScalar(200.4).add(V(0, -240, 0)); d.quaternion.setFromUnitVectors(UP(), nrm); d.scale.set(4 + r() * 12, 0.5, 3 + r() * 8); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.frustumCulled = false; s.add(im);
    const sp = []; for (let i = 0; i < 500; i++) { const a = r() * 6.28, e = r() * 1.4 - 0.25; sp.push(Math.cos(a) * Math.cos(e) * 5000, Math.sin(e) * 5000, Math.sin(a) * Math.cos(e) * 5000); }
    const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(sp, 3)); s.add(new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, fog: false })));
    const b = new T.Group(); s.add(b); W.balloon = b;
    add(b, new T.SphereGeometry(8, 20, 14), new T.MeshStandardMaterial({ color: 0xf5f7fa, transparent: true, opacity: 0.88, roughness: 0.6 }), 0, 21, 0).scale.set(1, 1.15, 1);
    add(b, new T.ConeGeometry(3.2, 5, 12).rotateX(Math.PI), M("#e6eaef", { flatShading: false }), 0, 11, 0);
    box(b, 3.4, 0.3, 3.4, "#8c96a3", 0, -0.15, 0);
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { beam(b, [x, 0, z], [x * 0.5, 9, z * 0.5], 0.035, "#dfe5ec"); box(b, 0.12, 1.1, 0.12, "#8c96a3", x, 0.55, z); }
    box(b, 3.4, 0.1, 0.1, "#8c96a3", 0, 1.1, -1.6); box(b, 0.1, 0.1, 3.4, "#8c96a3", -1.6, 1.1, 0);
  }

  /* ---- E: 東京 → 浜名湖の地図(1 = 1 km、実寸。+x が進む向き(西)、+z が北) ---- */
  function buildMap() {
    const s = set("map"); add(s, new T.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), M("#2f7fc4"));
    const coast = [[-300, -25], [-5, -25], [10, -8], [30, -10], [40, 6], [72, 8], [82, -10], [92, -50], [104, -48], [110, -5], [118, 10], [150, 8], [165, -12], [185, -22], [215, -8], [240, -7], [3000, -12], [3000, 3000], [-300, 3000]];
    const sh = new T.Shape(); coast.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    const land = add(s, new T.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }), M("#80b46f")); land.rotation.x = -Math.PI / 2; land.scale.y = -1; // (x, z) → (x, 0, z)
    land.material = M("#80b46f", { side: T.DoubleSide });
    const f = fujiMesh(s); f.scale.set(0.11, 0.1, 0.11); f.position.set(97, 0.3, 12);
    const r = rng(33), im = new T.InstancedMesh(new T.ConeGeometry(1, 1, 5), M("#6a9a66"), 70), d = new T.Object3D();
    for (let i = 0; i < 70; i++) { const x = -40 + r() * 420, z = 35 + r() * 260, h = 1 + r() * 2; d.position.set(x, 0.3 + h / 2, z); d.scale.set(6 + r() * 9, h, 6 + r() * 9); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } s.add(im);
    for (let i = 0; i < 40; i++) box(s, 0.8 + r() * 1.2, 0.4 + r() * 0.8, 0.8 + r() * 1.2, "#cfd5da", -9 + r() * 14, 0.6, -6 + r() * 20);
    add(s, new T.ConeGeometry(0.5, 2.2, 4), M("#ef5a2c"), 0, 1.4, 0);
    add(s, new T.CircleGeometry(5.5, 18).rotateX(-Math.PI / 2), M("#3c8fd0"), 221, 0.36, 3).scale.set(1, 1, 1.2);
    for (let i = 0; i < 46; i++) cloud(s, -20 + r() * 320, 4 + r() * 6, -70 + r() * 190, 2.2 + r() * 2.6, i + 60);
  }

  /* ---- F: 浜名湖(1 = 100 m。+x が東、+z が南) ---- */
  const LAKE = [[-4, 50], [-30, 52], [-55, 40], [-62, 15], [-50, -10], [-58, -35], [-40, -55], [-20, -45], [-5, -62], [15, -50], [30, -60], [45, -40], [40, -15], [58, 5], [50, 30], [28, 48], [4, 50]];
  function buildLake() {
    const s = set("lake"); W.water = waterTex(); W.water.repeat.set(260, 260); add(s, new T.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: W.water, roughness: 0.35, metalness: 0.1 }));
    const pts = [[-900, 80], [-4, 80], ...LAKE, [4, 80], [900, 80], [900, -1200], [-900, -1200]];
    const sh = new T.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    const land = add(s, new T.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false }), M("#7fb56c", { side: T.DoubleSide })); land.rotation.x = Math.PI / 2; land.position.y = 0.8;
    const sand = add(s, new T.PlaneGeometry(1800, 5).rotateX(-Math.PI / 2), M("#e6d7a3"), 0, 0.82, 78); W.sand = sand;
    const r = rng(77), inLake = (x, z) => inPoly(x, z, LAKE) || (Math.abs(x) < 6 && z > 48);
    const near = (x, z, m) => inLake(x, z) || inLake(x + m, z) || inLake(x - m, z) || inLake(x, z + m) || inLake(x, z - m);
    const n = 520, im = new T.InstancedMesh(new T.ConeGeometry(1, 1, 6), M("#4f8f55"), n), d = new T.Object3D(); let k = 0;
    while (k < n) { const x = -230 + r() * 460, z = -260 + r() * 330; if (near(x, z, 3) || Math.abs(z - 42) < 4 || (z > 56 && Math.abs(x + 8) < 10)) continue; const h = 2.6 + r() * 2.4; d.position.set(x, 0.8 + h / 2, z); d.scale.set(1.2 + r() * 0.7, h, 1.2 + r() * 0.7); d.updateMatrix(); im.setMatrixAt(k++, d.matrix); } s.add(im);
    for (let i = 0; i < 9; i++) add(s, new T.ConeGeometry(60 + r() * 50, 16 + r() * 16, 7), M("#6aa368"), -420 + i * 105, 8, -330 - r() * 120);
    for (let i = 0; i < 70; i++) { const x = 62 + r() * 150, z = 46 + r() * 28; if (Math.abs(z - 42) < 4) continue; box(s, 1.6 + r() * 2, 1 + r() * 2.4, 1.6 + r() * 2, r() < 0.3 ? "#d9b9a0" : "#eef0f2", x, 1.6, z); }
    // 新幹線の高架と橋
    box(s, 1800, 0.35, 2.2, "#b9c0c8", 0, 2.6, 42); for (let x = -240; x <= 240; x += 12) box(s, 0.9, 2.6, 1.6, "#a7afb8", x, 1.3, 42);
    const tr = new T.Group(); s.add(tr); W.train = tr;
    for (let i = 0; i < 8; i++) { box(tr, 7.4, 1.5, 1.5, "#fbfbf8", i * 7.7, 0.75, 0); box(tr, 7.4, 0.22, 1.54, "#2a5bd0", i * 7.7, 0.62, 0); box(tr, 6.4, 0.3, 1.53, "#1d2535", i * 7.7, 1.05, 0); }
    const nose = add(tr, new T.SphereGeometry(0.75, 12, 8), M("#fbfbf8", { flatShading: false }), -4.6, 0.72, 0); nose.scale.set(3.4, 0.95, 1);
    // うなぎ(誇張)
    const en = 5, seg = 16, em = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), M("#3a3f38", { flatShading: false, roughness: 0.4 }), en * seg); em.frustumCulled = false; s.add(em); W.eels = { em, en, seg };
    W.ripples = [0, 1, 2].map(() => add(s, new T.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), 5, 0.06, 5));
  }
  const EELC = [[-3, -6, 0.3], [15, 0, 1.9], [-8, 9, 4.0], [14, 13, 5.2], [2, 18, 2.6]];
  function eels(t, on) {
    const { em, en, seg } = W.eels, d = new T.Object3D(); em.visible = on; if (!on) return;
    for (let i = 0; i < en; i++) for (let j = 0; j < seg; j++) { const [cx, cz, ph] = EELC[i], a = t * 2.1 + ph - j * 0.13, dir = ph * 1.7;
      d.position.set(cx + Math.cos(a) * 4.5 * Math.cos(dir), Math.sin(a) * 4.2 - 1.2, cz + Math.cos(a) * 4.5 * Math.sin(dir)); d.scale.setScalar(j === 0 ? 0.62 : 0.52 - j * 0.02); d.updateMatrix(); em.setMatrixAt(i * seg + j, d.matrix); }
    em.instanceMatrix.needsUpdate = true;
  }
  const LAND = [5, 0.35, 5];
  const floatPlane = (t) => { W.water.offset.set(t * 0.012, t * 0.007); fly([LAND[0], LAND[1] + Math.sin(t * 2) * 0.08, LAND[2]], [-1, 0, 0.15], 5); };

  /* ---- 場面ごとの動き ---- */
  const S = {
    s1(p, t) {
      show("city", "#b9def3", 180, 700, "#4a98dc"); place(...TOP, CS); pose(p > 0.8 ? g.seg(p, 0.8, 1) * 0.35 : 0); inHand(0.55);
      const k = g.ease(p); cam(mix([30, 26, 70], [3.4, 35.1, 5], k), mix([0, 21, 0], [0.3, 34.2, 0], k));
    },
    s2(p, t) {
      show("city", "#b9def3", 180, 700, "#4a98dc"); place(...TOP, CS); pose(0); inHand(0.55);
      const k = g.ease(g.seg(p, 0.36, 0.5)); cam(mix([-3, 19, 100], [3, 34.5, 19], k), mix([-3, 14, 0], [3, 34.0, 0], k));
      W.dim.visible = p < 0.45; W.tri.visible = p > 0.46;
      if (p > 0.06 && p < 0.4) g.label("333 m", [-9.5, 18, 0], { size: 34, dx: -62, color: "#ffd84a" });
      if (p > 0.55) { g.label("6 m 進む", [3.3, 34.6, 0], { size: 27, dy: -24, color: "#ffd84a" }); g.label("1 m 落ちる", [5.7, 34.2, 0], { size: 27, dx: -4, dy: 52, color: "#ffd84a" }); }
      const gf = ((p - 0.5) * 2.6) % 1; W.ghost.position.set(0.9 + 4.8 * gf, 34.6 - 0.8 * gf + 0.12, 0); W.ghost.scale.setScalar(0.5); W.ghost.lookAt(100, 34.6 - 99.1 / 6, 0);
    },
    s3(p, t, dur) {
      show("city", "#b9def3", 180, 700, "#4a98dc"); place(...TOP, CS);
      const rel = pose(g.seg(p, 0, 0.13)), f = g.seg(p, 0.104, 0.8); let P;
      if (!rel) { P = inHand(0.55); } else { if (!W.rel3) W.rel3 = handPos(); P = cityPath(f, W.rel3); const P2 = cityPath(Math.min(1, f + 0.01), W.rel3); const sc = g.lerp(0.55, 2.4, g.ease(g.seg(f, 0, 0.1)));
        if (f < 1) fly(P, [P2[0] - P[0], P2[1] - P[1], 0], sc); else fly(P, [1, 0, 0], sc); trailTo([W.rel3[0], W.rel3[1], 0], P, 0.07); }
      const k = g.ease(g.seg(p, 0.09, 0.26)), e = g.ease(g.seg(p, 0.8, 1));
      cam(mix([3.4, 35.1, 5], [P[0] - 9 + e * 5, P[1] + 5 - e * 1.5, 25 - e * 5], k), mix([0.3, 34.2, 0], [P[0] + 4, P[1] - 1.5, 0], k));
      if (rel && f > 0.04) { if (f < 1) g.label(g.num(P[0] / 100, 2) + " km", P, { size: 30, dy: -52, color: "#ffd84a", loose: true }); else g.screen("約 2 km", 270, 300, { size: 54, color: "#ffd84a" }); }
      if (Math.abs(P[0] - 140) < 45) g.label("六本木ヒルズ", [148, 25, -16], { size: 24, dy: -20, loose: true });
    },
    s4(p, t) {
      show("city", "#b9def3", 180, 700, "#4a98dc"); place(...TOP, CS); pose(0); inHand(0.55);
      ch.head.rotation.y = Math.sin(g.seg(p, 0.08, 0.42) * Math.PI * 4) * 0.5; ch.head.rotation.x = -0.75 * g.ease(g.seg(p, 0.48, 0.7));
      const k = g.ease(g.seg(p, 0.55, 1)); cam(mix([3.4, 35.1, 5], [2.6, 33.7, 3.6], k), mix([0.3, 34.2, 0], [0.1, 34.9, 0], k));
    },
    s5(p, t) {
      show("fuji", "#b4dbf3", 260, 1500, "#4a98dc"); place(0, 37.6, 0, 2.2); const rel = pose(g.seg(p, 0.04, 0.26)), f = g.seg(p, 0.216, 0.95); let P;
      if (!rel) P = inHand(1.4); else { if (!W.rel5) W.rel5 = handPos(); const R = W.rel5, x = R[0] + (226.6 - R[0]) * f; P = [x, Math.max(0.6, 37.76 - x / 6 + (R[1] - 37.76 + R[0] / 6) * Math.exp(-(x - R[0]) / 20)), 0]; fly(P, [6, f < 1 ? -1 : 0, 0], g.lerp(1.4, 7, g.ease(g.seg(f, 0, 0.15)))); trailTo([R[0], R[1], 0], P, 0.22); }
      const k = g.ease(g.seg(p, 0.2, 0.42)); cam(mix([9, 41.4, 13], [-62, 58, 40], k), mix([0.6, 40.2, 0], [120, 6, 0], k));
      W.ring.visible = rel;
      if (p < 0.2) g.label("3,776 m", [0, 43.6, 0], { size: 32, dy: -30, color: "#ffd84a" });
      if (rel && f > 0.12) { if (f < 1) g.label(g.num(P[0] / 10, 1) + " km", P, { size: 28, dy: -40, color: "#ffd84a", loose: true }); else g.screen("約 23 km", 270, 240, { size: 54, color: "#ffd84a" }); }
    },
    s6(p, t, dur) {
      show("jet", "#7fbdf0", 300, 900, "#2f7bd6"); place(6, 2.2, 0, 1.7);
      const { im, d } = W.jetClouds, o = new T.Object3D(); d.forEach(([x, y, z, sc], i) => { o.position.set(((x - 70 * t) % 700 + 700) % 700 - 420, y, z); o.scale.set(sc * 1.6, sc * 0.45, sc); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.instanceMatrix.needsUpdate = true;
      const u = g.seg(p, 0.2, 0.46), rel = pose(u), tr = dur * (0.2 + 0.26 * 0.8), q = t - tr;
      if (!rel) inHand(1.1); else { if (!W.rel6) W.rel6 = handPos(); const R = W.rel6; fly([R[0] + 3 * Math.min(q, 0.25) - 42 * Math.max(0, q - 0.12) , R[1] - 5.5 * q, R[2] + 1.5 * q], [1, -0.16, 0], 2.2); ch.head.rotation.y = Math.PI * g.ease(g.seg(q, 0.15, 0.6)) * 0.9; }
      cam([50 + 5 * p, 13, 44 - 4 * p], [-1, 1.5, 0]);
      g.screen("高度 10,000 m", 270, 150, { size: 38, color: "#ffd84a" });
      if (p > 0.6) g.screen("飛距離 60 km", 270, 205, { size: 38, alpha: g.seg(p, 0.6, 0.68) });
    },
    s7(p, t) {
      show("strat", "#050a1c"); W.balloon.position.y = Math.sin(t * 0.8) * 0.15; place(0, W.balloon.position.y, 0, 1.15); ch.helmet.visible = true;
      const rel = pose(p > 0.72 ? g.seg(p, 0.72, 0.99) : 0); if (!rel) inHand(0.8); else { const q = g.seg(p, 0.936, 1); if (!W.rel7) W.rel7 = handPos(); fly([W.rel7[0] + q * 9, W.rel7[1] - q * 1.5, 0], [6, -1, 0], 0.8 + q); }
      const k = g.ease(p); cam(mix([5, 16, 15], [9.5, 4.2, 12.5], k), mix([0, 6, 0], [0.5, 1.4, 0], k), 62);
      if (p > 0.1) g.screen("高度 37 km", 270, 150, { size: 42, color: "#ffd84a", alpha: g.seg(p, 0.1, 0.2) });
    },
    s8(p, t) {
      const f = 0.02 + p * 0.9, P = [221 * f, 37 * (1 - f), 0], h = P[1] / 37;
      show("map", "#" + new T.Color("#9ccdf0").lerp(new T.Color("#0a1434"), g.clamp(h * 1.15 - 0.1)).getHexString()); ch.root.visible = false;
      fly(P, [6, -1, 0], 3.4); trailTo([0, 37, 0], P, 0.12);
      cam([P[0] - 32, P[1] + 11, P[2] - 7], [P[0] + 20, P[1] - 7, P[2] + 4], 44, 60);
      g.label(g.num(P[0], 0) + " km", P, { size: 30, dy: -64, color: "#ffd84a" });
      if (f > 0.2 && f < 0.56) g.label("富士山", [97, 4.2, 12], { size: 26, dy: -18, loose: true });
      if (f < 0.2) g.label("東京", [0, 3, 0], { size: 24, dy: -14, loose: true });
    },
    s9(p, t, dur) {
      show("lake", "#bfe2f4", 500, 1900, "#4a98dc"); ch.root.visible = false; eels(t, false); W.train.visible = false;
      const f = g.seg(p, 0, 0.55), tl = Math.max(0, t - dur * 0.55);
      W.water.offset.set(t * 0.012, t * 0.007); if (f < 1) { const P = mix([96, 15.5, 5], LAND, f); fly(P, [-6, -1, 0], 5); } else floatPlane(tl);
      W.ripples.forEach((r, i) => { const a = (tl * 0.55 + i / 3) % 1; r.visible = f >= 1; r.scale.setScalar(2 + a * 16); r.material.opacity = (1 - a) * 0.8; });
      const k = g.ease(p); cam(mix([40, 85, 215], [26, 30, 92], k), mix([0, 0, 12], [6, 0, 10], k));
      if (f < 1) g.label(g.num(204 + 18 * f, 0) + " km", plane.position, { size: 26, dy: -40, color: "#ffd84a", loose: true });
      if (p > 0.5) g.screen("浜名湖", 270, 190, { size: 46 + 26 * g.out(g.seg(p, 0.5, 0.62)), alpha: g.seg(p, 0.5, 0.58) });
    },
    s10(p, t) {
      show("lake", "#bfe2f4", 500, 1900, "#4a98dc"); ch.root.visible = false; W.train.visible = false; floatPlane(t + 9); W.ripples.forEach((r) => (r.visible = false));
      const b = p > 0.47; eels(t, b);
      if (!b) { const k = g.ease(p / 0.47); cam(mix([30, 50, 160], [22, 62, 176], k), mix([0, 0, 52], [0, 0, 60], k)); if (p > 0.06) { g.label("海", [-55, 0, 108], { size: 40, loose: true }); g.label("浜名湖", [0, 0, 8], { size: 30, loose: true }); g.label("ここでつながる", [0, 3, 66], { size: 24, dy: -26, color: "#ffd84a", loose: true }); } }
      else { const k = g.ease(g.seg(p, 0.47, 1)); cam(mix([40, 10, 46], [34, 7, 40], k), [6, 2.4, 6]); g.screen("うなぎ(大きさは誇張)", 270, 160, { size: 26, color: "#ffd84a" }); }
    },
    s11(p, t) {
      show("lake", "#bfe2f4", 500, 1900, "#4a98dc"); eels(t, false); floatPlane(t + 15); W.ripples.forEach((r) => (r.visible = false));
      place(-7.5, 0.8, 70, 2.6, -Math.PI / 2 + 0.2); ch.armR.rotation.set(0, 0, -2.5 + Math.sin(t * 7) * 0.3);
      W.train.visible = true; W.train.position.set(g.lerp(170, -200, g.seg(p, 0.05, 0.9)), 2.78, 42);
      cam([-3 + p * 1.5, 5.2, 88], [-7, 4.2, 50]);
      if (p > 0.45) g.screen("東京 → 浜松 約1時間半", 270, 150, { size: 34, color: "#ffd84a", alpha: g.seg(p, 0.45, 0.53) });
    },
  };

  window.WORLD = {
    init(G) {
      g = G; T = g.T;
      g.scene.add(new T.HemisphereLight(0xdcecff, 0x8a9ab0, 0.55)); const dl = new T.DirectionalLight(0xfff4e0, 0.75); dl.castShadow = true; dl.shadow.mapSize.set(2048, 2048); dl.shadow.bias = -0.0004; g.scene.add(dl, dl.target); W.sun = dl;
      buildCity(); buildFuji(); buildJet(); buildStrat(); buildMap(); buildLake();
      ch = makeChar(); g.scene.add(ch.root); plane = makePlane(); g.scene.add(plane);
      trail = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 6), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })); g.scene.add(trail);
      g.scene.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    },
    update(id, p, t, dur) { trail.visible = false; W.dim.visible = W.tri.visible = false; plane.visible = false; ch.root.visible = true; (S[id] || (() => {}))(p, t, dur); },
  };
})();
