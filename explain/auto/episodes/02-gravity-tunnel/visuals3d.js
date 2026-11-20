/* 第 2 回「穴に落ちたらどこに出る？」の 3D の場面。既製アセット方式:
   人物 = assets/human01(MakeHuman CC0 + CMU モーキャプ)、空・外壁・鉄板 = assets/env(Poly Haven / ambientCG、CC0)、
   地球 = assets/earth(NASA Blue Marble、パブリックドメイン)。造形するのは箱・筒・板などの単純な形だけ。
   window.WORLD = { preload(), init(g), update(sceneId, p, t, dur) }。動きは (場面, p, t) だけで決まる。 */
(() => {
  "use strict";
  let g, T, ch, holder, sun, hemi, pmrem, envSky, cur = "";
  const A = {}, sets = {}, W = {};
  const BASE = new URL("../../assets/", window.__VISUALS_URL).href;
  const R = 10, D2R = Math.PI / 180;
  const TOKYO = [35.6812, 139.7671], HAMA = [34.75, 137.58], ANTI = [-35.6812, -40.2329];
  const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

  const tex = (f, srgb, rx = 1, ry = 1) => new Promise((ok, ng) => new THREE.TextureLoader().load(BASE + f, (t) => {
    if (srgb) t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; ok(t);
  }, undefined, () => ng(new Error("texture " + f))));

  // 緯度経度 → 球面上の点(SphereGeometry の UV と一致する向き)
  const ll = (lat, lon, r = R) => { const ph = (90 - lat) * D2R, th = (lon + 180) * D2R; return new T.Vector3(-r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); };

  const set = (name) => { const s = new T.Group(); s.visible = false; g.scene.add(s); sets[name] = s; return s; };
  function show(name) {
    if (cur === name) return; cur = name;
    for (const k in sets) sets[k].visible = k === name;
    const sc = g.scene, out = name === "tokyo" || name === "lake";
    sc.background = out ? A.sky : new T.Color(name === "globe" ? 0x020409 : 0x000000);
    sc.environment = out ? envSky : null;
    sc.fog = name === "tokyo" ? new T.FogExp2(0xb9c9dc, 0.0016) : name === "lake" ? new T.FogExp2(0xbccbdc, 0.000045) : name === "tube" ? new T.Fog(0x000000, 25, 140) : null;
    g.renderer.toneMappingExposure = out ? 0.8 : 1.0;
    sun.castShadow = out; sun.intensity = out ? 1.5 : name === "globe" ? 2.3 : 0;
    hemi.intensity = name === "globe" ? 0.18 : name === "tube" ? 0.35 : 0.0;
    if (name !== "globe") g.camera.up.set(0, 1, 0);
  }
  // カメラを置き、注視点のまわりに影の範囲を合わせる
  const SD = [0.3, 0.93, 0.22];
  function cam(pos, look, fov = 40, size = 8) {
    g.cam(pos, look, fov);
    if (!sun.castShadow) return;
    sun.target.position.set(...look); sun.position.set(look[0] + SD[0] * size * 6, look[1] + SD[1] * size * 6, look[2] + SD[2] * size * 6);
    const c = sun.shadow.camera; c.left = c.bottom = -size; c.right = c.top = size; c.near = size * 2; c.far = size * 12; c.updateProjectionMatrix();
  }
  // 塗装した鉄板(Poly Haven の法線・粗さ)
  const paint = (c, rx, ry, side) => { const m = new T.MeshStandardMaterial({ color: new T.Color(c).convertSRGBToLinear(), normalMap: A.mn.clone(), roughnessMap: A.mr.clone(), metalness: 0.35, roughness: 1, side: side || T.FrontSide }); [m.normalMap, m.roughnessMap].forEach((t) => { t.repeat.set(rx, ry); t.needsUpdate = true; }); return m; };
  const glow = (() => { let t; return () => { if (t) return t; const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,240,200,.75)"); gr.addColorStop(1, "rgba(255,200,120,0)"); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (t = new T.CanvasTexture(c)); }; })();
  const sprite = (parent, color, s) => { const m = new T.Sprite(new T.SpriteMaterial({ map: glow(), color: new T.Color(color), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); m.scale.setScalar(s); parent.add(m); return m; };
  const beam = (parent, r, mat) => { const m = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 12), mat); parent.add(m); m.userData.r = r; return m; };
  const setBeam = (m, a, b) => { const d = new T.Vector3().subVectors(b, a), len = Math.max(d.length(), 1e-6); m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(m.userData.r, len, m.userData.r); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); };

  /* ---- 人物(human01)。外側の holder の +z が正面 ---- */
  const pose = (clip, t) => ch.play(clip, t);
  const put = (setName, x, y, z, ry = 0, s = 1) => { sets[setName].add(holder); holder.position.set(x, y, z); holder.rotation.set(0, ry, 0); holder.scale.setScalar(s); holder.visible = true; };

  /* ---- A: 東京の広場と穴(1 = 1 m) ---- */
  const HOLE = 1.2;
  function buildTokyo() {
    const s = set("tokyo");
    const sh = new T.Shape([new T.Vector2(-900, -900), new T.Vector2(900, -900), new T.Vector2(900, 900), new T.Vector2(-900, 900)]), hp = new T.Path();
    hp.absarc(0, 0, HOLE, 0, Math.PI * 2, true); sh.holes.push(hp);
    const ground = new T.Mesh(new T.ShapeGeometry(sh, 48).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.92, envMapIntensity: 0.1 }));
    ground.receiveShadow = true; s.add(ground);
    const shaft = new T.Mesh(new T.CylinderGeometry(HOLE, HOLE, 60, 40, 1, true), paint(0x8f969e, 6, 20, T.BackSide)); shaft.position.y = -30; shaft.receiveShadow = true; s.add(shaft);
    const rim = new T.Mesh(new T.TorusGeometry(HOLE + 0.06, 0.09, 12, 48).rotateX(Math.PI / 2), paint(0xf2c230, 4, 1)); rim.position.y = 0.04; rim.castShadow = rim.receiveShadow = true; s.add(rim);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; if (Math.abs(a - Math.PI) < 0.5) continue; const post = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.9, 8), paint(0xf2f0ea, 1, 1)); post.position.set(Math.cos(a) * (HOLE + 0.45), 0.45, Math.sin(a) * (HOLE + 0.45)); post.castShadow = true; s.add(post); }
    // 街: 写真由来の外壁テクスチャのビル(lab/shot01 と同じ作り)
    const r = rng(2024), roof = new T.MeshStandardMaterial({ color: 0x141619, roughness: 0.95, envMapIntensity: 0.5 }), dummy = new T.Object3D();
    const types = [[26, 28, 22, A.f6], [34, 44, 30, A.f1], [22, 18, 26, A.f6], [40, 70, 36, A.f1], [30, 34, 44, A.f6], [46, 120, 42, A.f1]];
    types.forEach(([w, h, d, ft], ti) => {
      const side = (len) => { const t = ft.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 28)), Math.max(1, Math.round(h / 28))); return new T.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.15, envMapIntensity: 0.7 }); };
      const mx = side(d), mz = side(w), n = ti === 5 ? 30 : 140, im = new T.InstancedMesh(new T.BoxGeometry(w, h, d), [mx, mx, roof, roof, mz, mz], n); let k = 0;
      while (k < n) { const x = (r() - 0.5) * 1700, z = (r() - 0.5) * 1700, gx = Math.round(x / 60) * 60, gz = Math.round(z / 60) * 60; if (Math.hypot(gx, gz) < 55) continue; dummy.position.set(gx, h / 2, gz); dummy.rotation.y = r() < 0.5 ? 0 : Math.PI / 2; dummy.updateMatrix(); im.setMatrixAt(k++, dummy.matrix); }
      im.castShadow = im.receiveShadow = true; im.frustumCulled = false; s.add(im);
    });
  }

  /* ---- B: 地球(半径 10) ---- */
  function buildGlobe() {
    const s = set("globe");
    W.clip = new T.Plane(new T.Vector3(0, 0, 1), 0);
    W.earthMat = new T.MeshStandardMaterial({ map: A.earth, roughness: 0.85, metalness: 0 });
    W.earth = new T.Mesh(new T.SphereGeometry(R, 160, 80), W.earthMat); s.add(W.earth);
    // 大気のふち
    const atm = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: "#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv;\n#include <logdepthbuf_vertex>\n}",
      fragmentShader: "#include <logdepthbuf_pars_fragment>\nvarying vec3 vN; varying vec3 vV; void main(){\n#include <logdepthbuf_fragment>\nfloat f = pow(1.0 - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(0.38, 0.62, 1.0, f*0.85); }" });
    W.atm = new T.Mesh(new T.SphereGeometry(R * 1.025, 96, 48), atm); s.add(W.atm);
    // 断面: 東京を通る子午線の面で切る。密度一様の仮定なので中身は 1 色
    const P = ll(...TOKYO), u = P.clone().normalize(), n = ll(0, TOKYO[1] + 90, 1).normalize(), w = new T.Vector3().crossVectors(n, u).normalize();
    W.u = u; W.n = n; W.w = w; W.P = P;
    const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"), gr = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, "#f6b25a"); gr.addColorStop(0.8, "#d9733a"); gr.addColorStop(0.97, "#9c4a2a"); gr.addColorStop(1, "#5a3020"); x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    const capT = new T.CanvasTexture(c); capT.encoding = T.sRGBEncoding;
    W.cap = new T.Mesh(new T.CircleGeometry(R * 0.998, 128), new T.MeshBasicMaterial({ map: capT })); W.cap.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n); s.add(W.cap);
    const lift = n.clone().multiplyScalar(0.03);
    // 穴(東京 → 真裏)と、ほかの方向への穴
    W.hole = beam(s, 0.11, new T.MeshBasicMaterial({ color: 0x2a1408 })); setBeam(W.hole, P.clone().add(lift), P.clone().negate().add(lift));
    W.trail = beam(s, 0.13, new T.MeshBasicMaterial({ color: 0xfff1c8 }));
    W.dot = sprite(s, 0xffffff, 2.2); W.core = new T.Mesh(new T.SphereGeometry(0.28, 16, 12), new T.MeshBasicMaterial({ color: 0xffffff })); s.add(W.core);
    W.fan = [];
    const fanCols = [0x7fd0ff, 0xa8f08a, 0xffe07a, 0xff9f7a];
    [55, 95, 135].forEach((deg, i) => {
      const E = u.clone().multiplyScalar(Math.cos(deg * D2R) * R).add(w.clone().multiplyScalar(Math.sin(deg * D2R) * R));
      const ln = beam(s, 0.07, new T.MeshBasicMaterial({ color: 0x2a1408 })); setBeam(ln, P.clone().add(lift), E.clone().add(lift));
      const d = sprite(s, fanCols[i], 1.7), core = new T.Mesh(new T.SphereGeometry(0.22, 12, 10), new T.MeshBasicMaterial({ color: fanCols[i] })); s.add(core);
      W.fan.push({ E, ln, d, core });
    });
    // 地表の印
    W.mTokyo = sprite(s, 0xff5040, 0.9); W.mTokyo.position.copy(ll(...TOKYO, R * 1.003));
    W.mAnti = sprite(s, 0xff5040, 1.4); W.mAnti.position.copy(ll(...ANTI, R * 1.004));
    W.mHama = sprite(s, 0x60d0ff, 0.12); W.mHama.position.copy(ll(...HAMA, R * 1.0008));
    W.mTk2 = sprite(s, 0xff5040, 0.12); W.mTk2.position.copy(ll(...TOKYO, R * 1.0008));
    // 東京 → 浜名湖の大圏(地表のすぐ上)
    const pts = []; for (let i = 0; i <= 40; i++) { const k = i / 40; pts.push(ll(TOKYO[0] + (HAMA[0] - TOKYO[0]) * k, TOKYO[1] + (HAMA[1] - TOKYO[1]) * k, R * 1.0006)); }
    W.arc = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.0045, 6, false), new T.MeshBasicMaterial({ color: 0xffe07a })); s.add(W.arc);
  }
  function globeMode(cut) {
    W.earthMat.clippingPlanes = cut ? [W.clip] : []; W.earthMat.needsUpdate = true;
    W.cap.visible = W.hole.visible = cut; W.atm.visible = !cut;
    if (cut) W.clip.normal.copy(W.n).negate();
    [W.trail, W.dot, W.core, W.mTokyo, W.mAnti, W.mHama, W.mTk2, W.arc].forEach((o) => (o.visible = false));
    W.fan.forEach((f) => (f.ln.visible = f.d.visible = f.core.visible = false));
  }
  const globeCam = (pos, look, up, fov = 40) => { g.camera.up.copy(up); g.cam([pos.x, pos.y, pos.z], [look.x, look.y, look.z], fov); const dir = pos.clone().normalize(); sun.position.copy(dir.multiplyScalar(60).add(new T.Vector3(0, 25, 0))); sun.target.position.set(0, 0, 0); };
  const dotAt = (o, core, v) => { o.visible = core.visible = true; o.position.copy(v); core.position.copy(v); };

  /* ---- C: 鉄板で内張りした穴の中(半径 2.2、軸はローカル z) ---- */
  const TR = 2.2, TL = 220, RING = 9;
  function buildTube() {
    const s = set("tube"); W.tg = new T.Group(); s.add(W.tg);
    W.tubeMat = paint(0x9aa1a8, 10, 80, T.BackSide);
    const wall = new T.Mesh(new T.CylinderGeometry(TR, TR, TL, 40, 1, true).rotateX(Math.PI / 2), W.tubeMat); W.tg.add(wall);
    W.rings = []; const rm = new T.MeshBasicMaterial({ color: 0xfff0cc }), sm = paint(0x55595e, 2, 1);
    for (let i = 0; i < TL / RING; i++) { const g0 = new T.Group(); const lamp = new T.Mesh(new T.TorusGeometry(TR - 0.05, 0.035, 6, 48), rm); const rib = new T.Mesh(new T.TorusGeometry(TR - 0.02, 0.09, 6, 48), sm); rib.position.z = 0.25; g0.add(lamp, rib); W.tg.add(g0); W.rings.push(g0); }
    W.lamp = new T.PointLight(0xfff0d8, 1.6, 30, 1.6); s.add(W.lamp);
  }
  function tubeScroll(off) { W.rings.forEach((r, i) => { r.position.z = ((((i * RING + off) % TL) + TL) % TL) - TL / 2; }); W.tubeMat.normalMap.offset.y = W.tubeMat.roughnessMap.offset.y = -off / TL * 80; }

  /* ---- D: 浜名湖(1 = 1 m、湖の形は模式図) ---- */
  function buildLake() {
    const s = set("lake");
    const water = new T.Mesh(new T.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x1b4252, roughness: 0.14, metalness: 0.05, envMapIntensity: 1.0 })); water.receiveShadow = true; s.add(water);
    // 陸: 長方形から湖(南の口で遠州灘につながる)を切り抜いた形。座標は (x 東, z 南) の m
    const lake = [[600, 4200], [800, 3500], [2000, 3000], [3500, 1500], [4000, -1000], [3500, -4000], [2500, -6500], [1500, -8000], [0, -7000], [-1000, -8500], [-2500, -7500], [-3500, -5000], [-4000, -3000], [-4500, -1000], [-3500, 2000], [-1500, 3000], [200, 3600]];
    const outline = [[200, 5200], [-30000, 5200], [-30000, -40000], [30000, -40000], [30000, 5200], [600, 5200], ...lake].map(([x, z]) => new T.Vector2(x, -z));
    const land = new T.Mesh(new T.ShapeGeometry(new T.Shape(outline)).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: new T.Color(0x587340).convertSRGBToLinear(), roughness: 1, envMapIntensity: 0.6 }));
    land.position.y = 1.5; land.receiveShadow = true; s.add(land);
    const r = rng(77), hillM = new T.MeshStandardMaterial({ color: new T.Color(0x3f5a34).convertSRGBToLinear(), roughness: 1 });
    for (let i = 0; i < 14; i++) { const h = new T.Mesh(new T.SphereGeometry(1, 24, 12), hillM); h.scale.set(4000 + r() * 4000, 120 + r() * 220, 3000 + r() * 3000); h.position.set(-26000 + i * 4000 + r() * 1500, 0, -20000 - r() * 12000); s.add(h); }
    // 町: 外壁テクスチャの低いビルを岸の外側に
    const dummy = new T.Object3D(), mats = [A.f1, A.f6].map((ft) => { const t = ft.clone(); t.needsUpdate = true; return new T.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.1 }); });
    mats.forEach((m, mi) => { const im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), m, 700); let k = 0; while (k < 700) { const x = 4500 + r() * 12000 - (mi ? 21000 : 0), z = -6000 + r() * 11000; const hh = 8 + r() * r() * 40; dummy.position.set(x, hh / 2 + 1.5, z); dummy.scale.set(15 + r() * 25, hh, 15 + r() * 25); dummy.updateMatrix(); im.setMatrixAt(k++, dummy.matrix); } im.frustumCulled = false; s.add(im); });
    // 穴の出口: 湖面から出た鉄の筒と足場
    const pipe = new T.Mesh(new T.CylinderGeometry(HOLE + 0.15, HOLE + 0.15, 6, 40, 1, true), paint(0x8f969e, 6, 2)); pipe.position.y = -2.4; pipe.castShadow = pipe.receiveShadow = true; s.add(pipe);
    const inner = new T.Mesh(new T.CylinderGeometry(HOLE, HOLE, 30, 40, 1, true), paint(0x6d737a, 6, 10, T.BackSide)); inner.position.y = -14.4; s.add(inner);
    const deckShape = new T.Shape(); deckShape.absarc(0, 0, 3.4, 0, Math.PI * 2, false); const dh = new T.Path(); dh.absarc(0, 0, HOLE + 0.15, 0, Math.PI * 2, true); deckShape.holes.push(dh);
    const deck = new T.Mesh(new T.ExtrudeGeometry(deckShape, { depth: 0.18, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2), paint(0x8f969e, 3, 3)); deck.position.y = 0.42; deck.castShadow = deck.receiveShadow = true; s.add(deck);
    const rim = new T.Mesh(new T.TorusGeometry(HOLE + 0.1, 0.08, 10, 48).rotateX(Math.PI / 2), paint(0xf2c230, 4, 1)); rim.position.y = 0.66; s.add(rim);
    const rail = paint(0xf2f0ea, 1, 1);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const post = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.0, 6), rail); post.position.set(Math.cos(a) * 3.3, 1.1, Math.sin(a) * 3.3); post.castShadow = true; s.add(post); }
    const top = new T.Mesh(new T.TorusGeometry(3.3, 0.03, 6, 64).rotateX(Math.PI / 2), rail); top.position.y = 1.6; s.add(top);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; const leg = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 4, 8), paint(0x55595e, 1, 2)); leg.position.set(Math.cos(a) * 3.0, -1.6, Math.sin(a) * 3.0); s.add(leg); }
  }
  const DECK = 0.6;

  window.WORLD = {
    async preload() {
      T = THREE;
      [A.sky, A.f1, A.f6, A.mn, A.mr, A.earth] = await Promise.all([tex("env/sky_puresky_4k.jpg", true), tex("env/facade001_color.jpg", true), tex("env/facade006_color.jpg", true), tex("env/metal_plate_nor_gl_1k.jpg"), tex("env/metal_plate_rough_1k.jpg"), tex("earth/earth_blue_marble_4k.jpg", true)]);
      A.sky.mapping = T.EquirectangularReflectionMapping; A.sky.wrapS = A.sky.wrapT = T.ClampToEdgeWrapping;
      A.earth.wrapS = T.RepeatWrapping; A.earth.wrapT = T.ClampToEdgeWrapping; A.earth.repeat.set(1, 1); A.earth.anisotropy = 16;
      ch = await AutoAssets.loadCharacter("human01");
    },
    init(G) {
      g = G; T = g.T;
      const rd = g.renderer; rd.outputEncoding = T.sRGBEncoding; rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = 0.8; rd.localClippingEnabled = true;
      pmrem = new T.PMREMGenerator(rd); envSky = pmrem.fromEquirectangular(A.sky).texture;
      sun = new T.DirectionalLight(0xfff1dc, 1.5); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; g.scene.add(sun, sun.target);
      hemi = new T.HemisphereLight(0xbfd4ff, 0x30281e, 0.2); g.scene.add(hemi);
      holder = new T.Group(); holder.add(ch.root);
      buildTokyo(); buildGlobe(); buildTube(); buildLake();
    },
    update(id, p, t, dur) {
      const { ease, seg, out, screen, label } = g;
      holder.visible = false;
      if (id === "s1") { // 東京の広場。穴のふちに立ち、最後に飛び込む
        show("tokyo");
        const j0 = 0.7, tj = (p - j0) * dur;
        if (p < j0) { pose("idle", t); put("tokyo", -1.75, 0, 0, Math.PI / 2); }
        else if (tj < 0.45) { pose("walk", 0.2 + tj); put("tokyo", -1.75 + tj * 2.2, Math.sin(tj / 0.45 * Math.PI) * 0.25, 0, Math.PI / 2); }
        else { const f = tj - 0.45; pose("hold", t); put("tokyo", -0.76 + f * 0.9, -4.9 * f * f, 0, Math.PI / 2); }
        const k = ease(seg(p, 0, 0.65)), k2 = ease(seg(p, 0.72, 1));
        let cp = mix([16, 11, 19], [3.4, 1.8, 4.4], k), lk = mix([0, 2.5, 0], [-0.7, 0.9, 0], k);
        cp = mix(cp, [1.6, 3.6, 2.2], k2); lk = mix(lk, [0, -1.5, 0], k2);
        cam(cp, lk, 40, 10);
        if (p < 0.6) label("東京", [0, 2.6, 0], { size: 26, dy: -10 });
      } else if (id === "s2") { // 断面: 東京から真裏まで 42 分
        show("globe"); globeMode(true);
        const tau = ease(seg(p, 0.12, 0.95)), pos = W.P.clone().multiplyScalar(Math.cos(Math.PI * tau)).add(W.n.clone().multiplyScalar(0.05));
        dotAt(W.dot, W.core, pos); W.trail.visible = tau > 0.002; if (W.trail.visible) setBeam(W.trail, W.P.clone().add(W.n.clone().multiplyScalar(0.04)), pos);
        W.mTokyo.visible = true;
        const k = ease(p), eye = W.n.clone().multiplyScalar(26 - 2 * k).add(W.w.clone().multiplyScalar(-40 + 4 * k)).add(W.u.clone().multiplyScalar(4));
        globeCam(eye, new T.Vector3(0, 0, 0), W.u, 40);
        screen(`${Math.round(42 * Math.min(1, seg(p, 0.12, 0.95)))}分`, 270, 150, { size: 54 });
        screen("※密度は一様、空気と摩擦はないと仮定", 270, 912, { size: 17, weight: 700 });
      } else if (id === "s3") { // 縦の穴を落ちていく
        show("tube"); W.tg.rotation.set(-Math.PI / 2, 0, 0);
        tubeScroll(70 * t + 9 * t * t);
        pose("wave", t * 1.3); put("tube", 0, -0.9, 0, 0.35 * Math.sin(t * 0.8));
        W.lamp.position.set(0.6, 2.5, 1.0);
        const a = 0.25 + 0.3 * p; cam([Math.sin(a) * 1.9, -2.6 + 0.6 * p, Math.cos(a) * 1.9], [0, 0.0, 0], 62, 4);
        screen(p < 0.48 ? "秒速 7.9km" : "時速 2万8千km", 270, 160, { size: 46 });
      } else if (id === "s4") { // 東京の真裏は大西洋
        show("globe"); globeMode(false); W.mAnti.visible = true; W.mAnti.scale.setScalar(1.2 + 0.25 * Math.sin(t * 5));
        const k = ease(seg(p, 0, 0.8)), A0 = ll(...ANTI), eye = ll(ANTI[0] - 6, ANTI[1] - 10 + 4 * k, R + 22 - 9 * k);
        globeCam(eye, A0.clone().multiplyScalar(0.92), new T.Vector3(0, 1, 0), 40);
        label("東京の真裏", [A0.x, A0.y, A0.z], { size: 28, dy: -46 });
      } else if (id === "s5") { // どの方向のまっすぐな穴でも 42 分
        show("globe"); globeMode(true); W.mTokyo.visible = true;
        const tau = ease(seg(p, 0.3, 0.95));
        dotAt(W.dot, W.core, W.P.clone().multiplyScalar(Math.cos(Math.PI * tau)).add(W.n.clone().multiplyScalar(0.06)));
        W.fan.forEach((f) => { f.ln.visible = true; const M = W.P.clone().add(f.E).multiplyScalar(0.5), H = W.P.clone().sub(f.E).multiplyScalar(0.5); dotAt(f.d, f.core, M.add(H.multiplyScalar(Math.cos(Math.PI * tau))).add(W.n.clone().multiplyScalar(0.06))); });
        const k = ease(p), eye = W.n.clone().multiplyScalar(26).add(W.w.clone().multiplyScalar(40 - 4 * k)).add(W.u.clone().multiplyScalar(4));
        globeCam(eye, new T.Vector3(0, 0, 0), W.u, 40);
        if (p > 0.3) screen("どれも 42分", 270, 150, { size: 46, alpha: out(seg(p, 0.3, 0.42)) });
      } else if (id === "s6") { // 日本に寄る。東京 → 浜名湖
        show("globe"); globeMode(false); W.arc.visible = W.mHama.visible = W.mTk2.visible = true;
        const k = ease(seg(p, 0, 0.7)), c = [(TOKYO[0] + HAMA[0]) / 2, (TOKYO[1] + HAMA[1]) / 2];
        const eye = ll(c[0] - 3.5 + 2.4 * k, c[1], R + 10 - 6 * k), look = ll(c[0] - 0.3 * k, c[1], R * (0.6 + 0.4 * k));
        globeCam(eye, look, new T.Vector3(0, 1, 0), 40);
        const m = ll(c[0], c[1], R);
        if (p > 0.35) label("224km", [m.x, m.y, m.z], { size: 34, dy: -40, alpha: out(seg(p, 0.35, 0.45)) });
        if (p > 0.6) label("深さ 約1km", [m.x, m.y, m.z], { size: 28, dy: 44, alpha: out(seg(p, 0.6, 0.7)) });
      } else if (id === "s7") { // 傾き 1 度の穴を滑っていく
        show("tube"); W.tg.rotation.set(0, 0, 0);
        const v = 500 * Math.min(1, seg(p, 0.15, 0.85)), off = 2.2 * dur * (seg(p, 0.15, 0.85) ** 2) * 60 + (p > 0.85 ? (p - 0.85) * dur * 140 : 0);
        tubeScroll(off);
        pose("hold", t); put("tube", 0, -TR + 0.12, 0, Math.PI);
        W.lamp.position.set(0.8, 0.8, 1.2);
        const k = ease(p); cam([1.2 - 0.6 * k, -0.6 - 0.3 * k, 3.6 - 0.8 * k], [0, -1.15, -1.5], 58, 4);
        screen(p < 0.12 ? "傾き 1度" : `時速 ${Math.round(v)}km`, 270, 160, { size: 46 });
      } else if (id === "s8") { // 42 分後、浜名湖の真ん中の出口から上がってくる(着いた所で速さは 0)
        show("lake"); g.scene.fog.density = 0.000045;
        const k = seg(p, 0.08, 0.7), y = -2.2 + (DECK - 0.0 + 2.2) * Math.sin(k * Math.PI / 2);
        pose(p < 0.72 ? "hold" : "look_up", p < 0.72 ? t : (p - 0.72) * dur); put("lake", 0, y, 0, Math.PI * 0.85);
        const c = ease(p); cam([5.5 - 1.5 * c, 1.2 + 0.4 * c, 8 - 2 * c], [0, 1.1, 0], 40, 8);
        screen("42分後", 270, 150, { size: 42 });
        if (p > 0.45) screen("浜名湖", 270, 212, { size: 50, alpha: out(seg(p, 0.45, 0.55)) });
      } else if (id === "s9") { // 浜名湖を空から(湖の形は模式図)
        show("lake"); g.scene.fog.density = 0.000014;
        pose("idle", t); put("lake", 2.2, DECK, 0.4, Math.PI * 0.7);
        const a = -0.35 + 0.35 * ease(p); cam([Math.sin(a) * 9000, 7600 - 800 * p, 2500 + Math.cos(a) * 9000], [0, 0, -1500], 40, 30);
        label("浜名湖", [0, 0, -2600], { size: 34 });
        label("海(遠州灘)", [300, 0, 7600], { size: 28 });
        screen("模式図", 270, 912, { size: 17, weight: 700 });
      } else if (id === "s10") { // 足場の上で手を振る。穴と新幹線の比較
        show("lake"); g.scene.fog.density = 0.000045;
        pose("wave", t); put("lake", 2.1, DECK, 0.2, Math.PI * 0.6);
        const k = ease(seg(p, 0.45, 1)); cam(mix([4.4, 1.7, 4.2], [26, 9, 30], k), mix([2.0, 1.25, 0.2], [0, 0.8, 0], k), 40, 10 + 30 * k);
        screen("新幹線 1時間14分", 270, 150, { size: 38 });
        screen("穴 42分(未着工)", 270, 205, { size: 34, alpha: out(seg(p, 0.4, 0.5)) });
      }
    },
  };
})();
