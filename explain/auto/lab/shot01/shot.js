/* 実験カット「タワーの上で投げる」: 既製アセット(空の写真、写真由来のテクスチャ、人物)だけで組む。1 = 1 m。
   window.renderAt(t) で時刻 t のコマを描く。?ch=keisan|human01 で人物を切り替える。 */
(async () => {
  "use strict";
  const T = THREE, W = 540, H = 960, ENV = "../../assets/env/", q = new URLSearchParams(location.search), CH = q.get("ch") || "keisan";
  const renderer = new T.WebGLRenderer({ canvas: document.getElementById("gl"), antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(2); renderer.setSize(W, H, false); renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, W / H, 0.05, 60000);
  const tl = new T.TextureLoader(), tex = (f, srgb, rx = 1, ry = 1) => new Promise((ok, ng) => tl.load(ENV + f, (t) => { if (srgb) t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; ok(t); }, undefined, ng));
  // 空: Poly Haven の全天写真を背景と環境光に使う
  const sky = await tex("sky_puresky_4k.jpg", true); sky.mapping = T.EquirectangularReflectionMapping; sky.wrapS = sky.wrapT = T.ClampToEdgeWrapping;
  scene.background = sky; const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(sky).texture;
  const HAZE = new T.Color(0xb9c9dc); scene.fog = new T.FogExp2(HAZE, 0.00016);
  const sun = new T.DirectionalLight(0xfff1dc, 1.5), SD = new T.Vector3(0.3, 0.93, 0.22).normalize(); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
  const TOP = 333;
  // 街: 写真由来の外壁テクスチャを貼ったビル(種類ごとに大きさ固定、配置は種を固定した乱数)
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const f1 = await tex("facade001_color.jpg", true), f6 = await tex("facade006_color.jpg", true);
  const roof = new T.MeshStandardMaterial({ color: 0x141619, roughness: 0.95, envMapIntensity: 0.5 });
  const types = [[26, 28, 22, f6], [34, 44, 30, f1], [22, 18, 26, f6], [40, 70, 36, f1], [30, 34, 44, f6], [46, 170, 42, f1], [18, 12, 20, f6], [36, 22, 28, f1]];
  const dummy = new T.Object3D();
  types.forEach(([w, h, d, ft], ti) => {
    const side = (len) => { const t = ft.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 28)), Math.max(1, Math.round(h / 28))); return new T.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.15, envMapIntensity: 0.7 }); };
    const mx = side(d), mz = side(w), n = ti === 5 ? 45 : ti === 3 ? 160 : 700, im = new T.InstancedMesh(new T.BoxGeometry(w, h, d), [mx, mx, roof, roof, mz, mz], n); let k = 0;
    while (k < n) { const x = (rnd() - 0.5) * 7000, z = (rnd() - 0.5) * 7000, gx = Math.round(x / 62) * 62 + (rnd() - 0.5) * 8, gz = Math.round(z / 62) * 62 + (rnd() - 0.5) * 8; if (Math.hypot(gx, gz) < 150) continue; dummy.position.set(gx, h / 2, gz); dummy.rotation.y = rnd() < 0.5 ? 0 : Math.PI / 2; dummy.updateMatrix(); im.setMatrixAt(k++, dummy.matrix); }
    im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  });
  const ground = new T.Mesh(new T.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 1, envMapIntensity: 0.4 })); ground.receiveShadow = true; scene.add(ground);
  // 塔: 塗装した鉄板のテクスチャ。頂上は足場つきのトラス
  const mn = await tex("metal_plate_nor_gl_1k.jpg"), mr = await tex("metal_plate_rough_1k.jpg");
  const paint = (c, rx, ry) => { const m = new T.MeshStandardMaterial({ color: new T.Color(c).convertSRGBToLinear(), normalMap: mn.clone(), roughnessMap: mr.clone(), metalness: 0.35, roughness: 1 }); [m.normalMap, m.roughnessMap].forEach((t) => { t.repeat.set(rx, ry); t.needsUpdate = true; }); return m; };
  const RED = paint(0xff5a2a, 1, 1), WHT = paint(0xf2f0ea, 1, 1), GRY = paint(0xb0b6bd, 2, 2);
  const tower = new T.Group(); scene.add(tower);
  const tube = (a, b, r, m) => { const d = new T.Vector3().subVectors(b, a), me = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 8), m); me.position.copy(a).add(b).multiplyScalar(0.5); me.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); me.castShadow = me.receiveShadow = true; tower.add(me); };
  const half = (y) => (y > 250 ? 1.2 + (TOP - y) * 0.03 : y > 150 ? 3.7 + (250 - y) * 0.11 : 14.7 + Math.pow((150 - y) / 150, 1.7) * 42);
  const levels = [0, 30, 60, 90, 120, 150, 170, 190, 210, 230, 250, 262, 274, 286, 298, 310, 321, 331];
  for (let i = 0; i < levels.length - 1; i++) { const y0 = levels[i], y1 = levels[i + 1], a = half(y0), b = half(y1), m = i % 2 ? WHT : RED, r = y0 > 250 ? 0.12 : y0 > 150 ? 0.3 : 0.7;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) { const nx = -sz, nz = sx; // 隣の柱
      tube(new T.Vector3(sx * a, y0, sz * a), new T.Vector3(sx * b, y1, sz * b), r, m);
      tube(new T.Vector3(sx * b, y1, sz * b), new T.Vector3(nx * b, y1, nz * b), r * 0.7, m);
      tube(new T.Vector3(sx * a, y0, sz * a), new T.Vector3(nx * b, y1, nz * b), r * 0.55, m); tube(new T.Vector3(nx * a, y0, nz * a), new T.Vector3(sx * b, y1, sz * b), r * 0.55, m); } }
  const deck = (y, s, h) => { const m = new T.Mesh(new T.BoxGeometry(s, h, s), GRY); m.position.y = y; m.castShadow = m.receiveShadow = true; tower.add(m); }; deck(150, 34, 9); deck(250, 12, 6);
  const plat = new T.Mesh(new T.CylinderGeometry(2.1, 2.1, 0.12, 36), paint(0x8f969e, 2, 2)); plat.position.y = TOP - 0.06; plat.castShadow = plat.receiveShadow = true; tower.add(plat);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; if (Math.sin(a) > -0.2 || Math.cos(a) > 0.6) continue; tube(new T.Vector3(Math.cos(a) * 2.0, TOP, Math.sin(a) * 2.0), new T.Vector3(Math.cos(a) * 2.0, TOP + 1.05, Math.sin(a) * 2.0), 0.016, WHT); }
  // 人物と紙飛行機
  const ch = await AutoAssets.loadCharacter(CH), holder = new T.Group(); holder.add(ch.root); holder.position.set(CH === "human01" ? -0.75 : 0, TOP, 0); holder.rotation.y = Math.PI / 2; scene.add(holder);
  const plane = await AutoAssets.loadModel("paper_plane"); plane.traverse((o) => { if (o.isMesh) { o.material.side = T.DoubleSide; o.castShadow = true; } }); const pg = new T.Group(); plane.scale.setScalar(0.45); pg.add(plane); scene.add(pg);
  const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }, mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), hv = new T.Vector3();
  const T0 = 1.3, REL = ch.releaseTime || 0.73; ch.play("throw", REL); holder.updateMatrixWorld(true); ch.handR.getWorldPosition(hv); const rel = [hv.x, hv.y + 0.03, hv.z];
  window.DUR = 5.2;
  window.renderAt = (t) => {
    const tt = t - T0; if (tt < 0) ch.play("hold", t); else ch.play("throw", Math.min(tt, ch.clips && ch.clips.throw ? ch.clips.throw.duration || 1.2 : 1.2));
    holder.updateMatrixWorld(true); ch.handR.getWorldPosition(hv); let P;
    if (tt < REL) { P = [hv.x, hv.y + 0.03, hv.z]; pg.position.set(...P); pg.lookAt(P[0] + 1, P[1] + 0.12, P[2]); }
    else { const s = tt - REL, x = rel[0] + 7.5 * s; P = [x, rel[1] - (x - rel[0]) / 6 + 0.25 * (1 - Math.exp(-s * 3)), rel[2]]; pg.position.set(...P); pg.lookAt(P[0] + 6, P[1] - 1, P[2]); }
    const k = ease((tt - REL - 0.1) / 1.6), c0 = [2.4 - 0.4 * ease(t / T0), TOP + 1.5, 5.0], l0 = [0.05, TOP + 1.0, 0];
    const cp = mix(c0, [P[0] - 3.2, P[1] + 0.9, 3.6], k), lk = mix(l0, [P[0] + 0.3, P[1] - 0.15, 0], k);
    camera.position.set(...cp); camera.lookAt(...lk);
    sun.target.position.set(...lk); sun.position.set(lk[0] + SD.x * 60, lk[1] + SD.y * 60, lk[2] + SD.z * 60); const sc = sun.shadow.camera; sc.left = sc.bottom = -7; sc.right = sc.top = 7; sc.near = 20; sc.far = 100; sc.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  window.__READY = true;
})().catch((e) => { window.__ERR = String(e && e.stack || e); window.__READY = true; });
