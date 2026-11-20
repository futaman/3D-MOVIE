/* 第 5 回「1円玉の塔」の 3D の場面(ネタ落ち型)。
   既製アセット: 人物 human01、空・外壁 assets/env、地球 assets/earth、浜名湖 assets/hamanako。1 円玉は模様のない円板(貨幣の図柄は描かない)。
   セット: plaza(街角で積む。1 = 1 m)、globe(半径 10 = 6371 km)、lake(浜名湖の実地形、1 = 1 m)。 */
(() => {
  "use strict";
  let g, T, ch, holder, sun, envSky, cur = "";
  const A = {}, sets = {}, W = {};
  const BASE = new URL("../../assets/", window.__VISUALS_URL).href;
  const R = 10, KM = R / 6371, D2R = Math.PI / 180, SKY = [35.7101, 139.8107], HAMA = [34.75, 137.58], TH = 0.0015;
  const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const tex = (f, srgb) => new Promise((ok, ng) => new THREE.TextureLoader().load(BASE + f, (t) => { if (srgb) t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; ok(t); }, undefined, () => ng(new Error("texture " + f))));
  const set = (name) => { const s = new T.Group(); s.visible = false; g.scene.add(s); sets[name] = s; return s; };
  function show(name) {
    if (cur === name) return; cur = name;
    for (const k in sets) sets[k].visible = k === name;
    const sp = name === "globe"; g.scene.background = sp ? new T.Color(0x020409) : A.sky; g.scene.environment = sp ? null : envSky;
    g.scene.fog = sp ? null : name === "lake" ? new T.FogExp2(0xbccbdc, 0.00004) : new T.FogExp2(0xb9c9dc, 0.002);
    sun.castShadow = name === "plaza"; sun.intensity = sp ? 2.3 : 1.5;
    if (!sp) g.camera.up.set(0, 1, 0);
  }
  function cam(pos, look, fov = 40, size = 3) {
    g.cam(pos, look, fov); if (!sun.castShadow) return;
    sun.target.position.set(...look); sun.position.set(look[0] + size * 2, look[1] + size * 6, look[2] + size * 3);
    const c = sun.shadow.camera; c.left = c.bottom = -size; c.right = c.top = size; c.near = size * 2; c.far = size * 14; c.updateProjectionMatrix();
  }
  const ll = (lat, lon, r = R) => { const ph = (90 - lat) * D2R, th = (lon + 180) * D2R; return new T.Vector3(-r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); };
  const ALU = () => new T.MeshStandardMaterial({ color: 0xd4d7db, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 });
  const coinGeo = () => { const pts = [[0, 0], [0.0098, 0], [0.01, 0.0002], [0.01, 0.0013], [0.0098, 0.0015], [0.0088, 0.0015], [0.0087, 0.0012], [0, 0.0012]].map(([x, y]) => new T.Vector2(x, y)); return new T.LatheGeometry(pts, 40); };

  /* ---- 街角 ---- */
  const NMAX = 1200;
  function buildPlaza() {
    const s = set("plaza");
    const ground = new T.Mesh(new T.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: new T.Color(0x2a2c30).convertSRGBToLinear(), roughness: 0.92, envMapIntensity: 0.2 })); ground.receiveShadow = true; s.add(ground);
    const ped = new T.Mesh(new T.BoxGeometry(0.5, 0.75, 0.5), new T.MeshStandardMaterial({ color: new T.Color(0x9b968c).convertSRGBToLinear(), roughness: 0.9 })); ped.position.set(0, 0.375, 0); ped.castShadow = ped.receiveShadow = true; s.add(ped);
    W.top = 0.75;
    W.stack = new T.InstancedMesh(coinGeo(), ALU(), NMAX); W.stack.castShadow = true; W.stack.receiveShadow = true; s.add(W.stack);
    const r = rng(5), dummy = new T.Object3D(), roof = new T.MeshStandardMaterial({ color: 0x141619 });
    [A.f1, A.f6].forEach((ft) => { const t = ft.clone(); t.needsUpdate = true; t.repeat.set(1, 2); const m = new T.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.15 }), im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), [m, m, roof, roof, m, m], 30); let k = 0;
      while (k < 30) { const x = (r() - 0.5) * 260, z = -30 - r() * 160, h = 15 + r() * 50; dummy.position.set(x, h / 2, z); dummy.scale.set(14 + r() * 10, h, 14 + r() * 10); dummy.updateMatrix(); im.setMatrixAt(k++, dummy.matrix); } s.add(im); });
  }
  const dmy = new (window.THREE.Object3D)();
  // n 枚積む。crush > 0 で下のほうがつぶれる(見た目の強調)
  function stack(n, crush = 0) {
    n = Math.min(NMAX, Math.max(0, Math.floor(n))); let y = W.top;
    for (let i = 0; i < NMAX; i++) {
      if (i >= n) { dmy.scale.setScalar(0); dmy.updateMatrix(); W.stack.setMatrixAt(i, dmy.matrix); continue; }
      const sq = crush > 0 ? Math.max(0.25, 1 - crush * Math.max(0, 1 - i / 60)) : 1, rr = 1 + (1 - sq) * 0.6;
      dmy.position.set(Math.sin(i * 1.7) * 0.0004, y, Math.cos(i * 2.3) * 0.0004); dmy.rotation.set(0, i * 0.9, 0); dmy.scale.set(rr, sq, rr); dmy.updateMatrix(); W.stack.setMatrixAt(i, dmy.matrix); y += TH * sq;
    }
    W.stack.instanceMatrix.needsUpdate = true; return y;
  }

  /* ---- 地球と塔 ---- */
  function buildGlobe() {
    const s = set("globe");
    s.add(new T.Mesh(new T.SphereGeometry(R, 256, 128), new T.MeshStandardMaterial({ map: A.earth, roughness: 0.85 })));
    W.karman = new T.Mesh(new T.SphereGeometry(R * (1 + 100 / 6371), 128, 64), new T.MeshBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.12, depthWrite: false })); s.add(W.karman);
    W.tower = new T.Group(); s.add(W.tower);
    W.towerMesh = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0), new T.MeshBasicMaterial({ color: 0xe8ecf0 })); W.tower.add(W.towerMesh);
    W.base = ll(...SKY); W.up = W.base.clone().normalize();
    const tgt = ll(...HAMA).normalize(); W.axis = new T.Vector3().crossVectors(W.up, tgt).normalize();   // 倒れる回転軸(浜名湖の向き)
    W.tower.position.copy(W.base); W.tower.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), W.up); W.q0 = W.tower.quaternion.clone();
    const glow = document.createElement("canvas"); glow.width = glow.height = 64; const x = glow.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    W.mk = [SKY, HAMA].map((p, i) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(glow), color: i ? 0x60d0ff : 0xff6050, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sp.scale.setScalar(0.06); sp.position.copy(ll(...p, R * 1.001)); s.add(sp); return sp; });
  }
  function tower(hKm, fall = 0) {
    W.tower.visible = hKm > 0; const h = Math.max(1e-6, hKm * KM); W.towerMesh.scale.set(Math.max(0.004, h * 0.012), h, Math.max(0.004, h * 0.012));
    const q = new T.Quaternion().setFromAxisAngle(W.axis, (Math.PI / 2) * fall); W.tower.quaternion.copy(q).multiply(W.q0);
  }
  const globeCam = (eye, look, up) => { g.camera.up.copy(up); g.cam([eye.x, eye.y, eye.z], [look.x, look.y, look.z], 40); sun.position.copy(eye.clone().normalize().multiplyScalar(60).add(new T.Vector3(0, 20, 0))); sun.target.position.set(0, 0, 0); };

  /* ---- 浜名湖に降る 1 円玉 ---- */
  function buildLake() {
    const s = set("lake"); s.add(A.hama.root);
    W.rain = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 0.15, 16), ALU(), 400); s.add(W.rain);
    W.rainSeed = []; const r = rng(9); for (let i = 0; i < 400; i++) W.rainSeed.push([(r() - 0.5) * 9000, (r() - 0.5) * 9000, r(), r() * 6.28]);
  }
  function rain(k) {
    W.rainSeed.forEach(([x, z, ph, rot], i) => { const tt = (k * 1.5 + ph) % 1, y = 6000 * (1 - tt); dmy.position.set(x, y, z - 1500); dmy.rotation.set(rot + k * 8, rot, 0); dmy.scale.setScalar(k > 0 ? 55 : 0); dmy.updateMatrix(); W.rain.setMatrixAt(i, dmy.matrix); });
    W.rain.instanceMatrix.needsUpdate = true;
  }

  window.WORLD = {
    async preload() {
      T = THREE;
      [A.sky, A.f1, A.f6, A.earth] = await Promise.all([tex("env/sky_puresky_4k.jpg", true), tex("env/facade001_color.jpg", true), tex("env/facade006_color.jpg", true), tex("earth/earth_blue_marble_4k.jpg", true)]);
      A.sky.mapping = T.EquirectangularReflectionMapping; A.sky.wrapS = A.sky.wrapT = T.ClampToEdgeWrapping; A.earth.anisotropy = 16;
      ch = await AutoAssets.loadCharacter("human01");
      A.hama = await AutoAssets.loadTerrain("hamanako", { coastZ: 9000 });
    },
    init(G) {
      g = G; T = g.T;
      const rd = g.renderer; rd.outputEncoding = T.sRGBEncoding; rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = 0.85;
      envSky = new T.PMREMGenerator(rd).fromEquirectangular(A.sky).texture;
      sun = new T.DirectionalLight(0xfff1dc, 1.5); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.01; g.scene.add(sun, sun.target);
      g.scene.add(new T.HemisphereLight(0xdfe8ff, 0x3a3530, 0.25));
      holder = new T.Group(); holder.add(ch.root);
      buildPlaza(); buildGlobe(); buildLake();
    },
    update(id, p, t, dur) {
      const { ease, seg, out, screen, label } = g; holder.visible = false;
      const placePerson = (clip, tt) => { ch.play(clip, tt); sets.plaza.add(holder); holder.position.set(-0.55, 0, 0.1); holder.rotation.set(0, Math.PI / 2, 0); holder.visible = true; };
      if (id === "s1") { // 1 枚ずつ積む
        show("plaza"); const n = 1 + Math.floor(seg(p, 0.1, 0.95) * 40); const top = stack(n); placePerson("hold", t);
        const k = ease(p); cam(mix([2.6, 1.9, 4.2], [0.16, 0.84, 0.3], k), [0, mix([1.1], [0.79], k)[0], 0], 40, 2);
      } else if (id === "s2") { // 634 m には 42 万枚
        show("plaza"); const top = stack(NMAX); placePerson("look_up", Math.min(1, p * 2));
        const k = ease(p); cam(mix([0.6, 1.0, 0.9], [2.2, 2.6, 5.5], k), mix([0, 0.9, 0], [0, 2.0, 0], k), 40, 3);
        if (p > 0.4) screen("634m まで 42万2667枚", 270, 150, { size: 36, alpha: out(seg(p, 0.4, 0.5)) });
      } else if (id === "s3") { // 1157 年
        show("plaza"); stack(NMAX); placePerson("idle", t);
        cam([3.4, 1.6, 5.5], [0, 1.4, 0], 40, 3); const yy = Math.round(1157 * ease(seg(p, 0.05, 0.85))); screen(`${yy}年後`, 270, 150, { size: 50 }); if (p > 0.6) screen(`西暦${2026 + yy}年`, 270, 210, { size: 36, alpha: out(seg(p, 0.6, 0.7)) });
      } else if (id === "s4" || id === "s5" || id === "s6") { // 地球から生える塔
        show("globe"); W.karman.visible = id === "s6"; W.mk[1].visible = false;
        const h = id === "s4" ? 229 * ease(seg(p, 0.15, 0.9)) : 229; tower(h, 0);
        const side = W.axis.clone(), up = W.up, eye = W.base.clone().add(side.clone().multiplyScalar(id === "s6" ? 1.3 : 1.0)).add(up.clone().multiplyScalar(0.35)), look = W.base.clone().add(up.clone().multiplyScalar(0.18));
        globeCam(eye, look, up);
        if (id === "s4" && h > 70) label(`${Math.round(h)}km`, W.base.clone().add(up.clone().multiplyScalar(h * KM)).toArray(), { size: 30, dx: 46 });
        if (id === "s5") screen("約1億5千万枚", 270, 150, { size: 44 });
        if (id === "s6") label("高さ100km", W.base.clone().add(up.clone().multiplyScalar(100 * KM)).toArray(), { size: 26, dx: -70 });
      } else if (id === "s7") { // 西へ倒れる
        show("globe"); W.karman.visible = false; W.mk[1].visible = true; const f = ease(seg(p, 0.35, 0.95)) ** 1.6; tower(229, f);
        const mid = W.base.clone().add(ll(...HAMA)).multiplyScalar(0.5), up = mid.clone().normalize(), eye = mid.clone().add(up.clone().multiplyScalar(1.6)).add(W.axis.clone().multiplyScalar(0.9));
        globeCam(eye, mid, up); if (p > 0.6) label("229km先", ll(...HAMA, R * 1.001).toArray(), { size: 28, dy: 34, alpha: out(seg(p, 0.6, 0.7)) });
      } else if (id === "s8") { // 浜名湖に降る
        show("lake"); g.scene.fog.density = 0.00007; rain(p); g.cam([2500, 6500 - 1500 * p, 8000], [0, 0, -1800], 40);
        if (p > 0.4) label("浜名湖", [-1500, 0, -800], { size: 34, alpha: out(seg(p, 0.4, 0.5)) });
      } else if (id === "s9") { // 浜名湖を淡々と
        show("lake"); g.scene.fog.density = 0.00004; rain(0); const a = -0.25 + 0.3 * ease(p); g.cam([Math.sin(a) * 13000, 12500 - 1500 * p, 1500 + Math.cos(a) * 13000], [0, 0, -2500], 40);
        label("浜名湖", [-1500, 0, -800], { size: 34 });
      } else if (id === "s10") { // 下の 1 円玉が潰れる
        show("plaza"); const c = ease(seg(p, 0.15, 0.6)); stack(NMAX, c); placePerson(p < 0.5 ? "idle" : "shake_head", p < 0.5 ? t : (p - 0.5) * dur);
        cam([0.22, 0.86, 0.42], [0, 0.8, 0], 40, 1); if (p > 0.3) screen("高さ 約1.4km で", 270, 150, { size: 40, alpha: out(seg(p, 0.3, 0.4)) });
      }
    },
  };
})();
