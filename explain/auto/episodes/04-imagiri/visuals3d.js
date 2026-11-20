/* 第 4 回「浜名湖が海とつながるまで」の 3D の場面(段階型)。
   実際の浜名湖の地形(assets/hamanako)の上に、昔の砂の堤・津波・口の幅・東海道などを模式的に重ねる。
   s3 だけ地球(assets/earth)で近江と遠江を並べる。1 = 1 m、原点は湖の中(34.75N 137.58E)、x = 東、z = 南。 */
(() => {
  "use strict";
  let g, T, sun, envSky, cur = "";
  const A = {}, sets = {}, W = {};
  const BASE = new URL("../../assets/", window.__VISUALS_URL).href;
  const M = [1816, 7875];                     // 今切口(水域データで湖と海がつながる所)
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const tex = (f, srgb) => new Promise((ok, ng) => new THREE.TextureLoader().load(BASE + f, (t) => { if (srgb) t.encoding = THREE.sRGBEncoding; ok(t); }, undefined, () => ng(new Error("texture " + f))));
  const set = (name) => { const s = new T.Group(); s.visible = false; g.scene.add(s); sets[name] = s; return s; };
  function show(name) {
    if (cur === name) return; cur = name;
    for (const k in sets) sets[k].visible = k === name;
    g.scene.background = name === "globe" ? new T.Color(0x020409) : A.sky; g.scene.environment = name === "globe" ? null : envSky;
    g.scene.fog = name === "globe" ? null : new T.FogExp2(0xbccbdc, 0.000035);
    sun.intensity = name === "globe" ? 2.2 : 1.5;
  }
  const cam = (pos, look, fov = 40) => { g.cam(pos, look, fov); sun.target.position.set(...look); sun.position.set(look[0] + 3000, look[1] + 9000, look[2] + 2500); };
  const std = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: new T.Color(c).convertSRGBToLinear(), roughness: 0.9, metalness: 0 }, o));
  const H = (x, z) => Math.max(0, W.tr.heightAt(x, z));
  const glow = () => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(200,240,255,.6)"); gr.addColorStop(1, "rgba(150,220,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); };

  function buildLake() {
    const s = set("lake"); W.tr = A.hama; s.add(W.tr.root);
    W.waterMat = W.tr.water.material; W.seaCol = W.waterMat.color.clone(); W.freshCol = new T.Color(0x2c5a46).convertSRGBToLinear();
    // 昔の砂の堤(口をふさぐ)。左右 2 つに分けて、切れるところを動かす
    const sand = std("#d9c9a0", { roughness: 1 }); W.bar = [-1, 1].map((sx) => { const b = new T.Mesh(new T.CylinderGeometry(1, 1, 3, 48), sand); b.scale.set(1, 1, 1); b.userData.rz = 650; b.position.set(M[0] + sx * 400, 1.6, M[1]); s.add(b); return b; });
    // 津波(模式)
    W.wave = new T.Mesh(new T.BoxGeometry(40000, 14, 500), new T.MeshStandardMaterial({ color: new T.Color(0xdfeff5).convertSRGBToLinear(), roughness: 0.3, transparent: true, opacity: 0.75 })); s.add(W.wave);
    // 口の幅(模式。水の帯を重ねる)
    const mc = document.createElement("canvas"); mc.width = 64; mc.height = 256; const mx = mc.getContext("2d"), mg = mx.createLinearGradient(0, 0, 0, 256); mg.addColorStop(0, "rgba(255,255,255,0)"); mg.addColorStop(0.25, "rgba(255,255,255,1)"); mg.addColorStop(0.75, "rgba(255,255,255,1)"); mg.addColorStop(1, "rgba(255,255,255,0)"); mx.fillStyle = mg; mx.fillRect(0, 0, 64, 256);
    W.mouth = new T.Mesh(new T.PlaneGeometry(1, 2400).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: new T.Color(0x16394a).convertSRGBToLinear(), roughness: 0.12, transparent: true, alphaMap: new T.CanvasTexture(mc), depthWrite: false })); W.mouth.position.set(M[0], 9, M[1] - 200); s.add(W.mouth);
    // 東海道(模式。地表に沿った破線)。口のところは舟
    W.road = new T.Group(); s.add(W.road); const rm = new T.MeshBasicMaterial({ color: 0xffb020, fog: false, toneMapped: false });
    for (let x = -9000; x < 12000; x += 760) { if (Math.abs(x - M[0]) < 700) continue; const z = M[1] - 900 + 0.00002 * (x - M[0]) * (x - M[0]); const d = new T.Mesh(new T.BoxGeometry(520, 14, 190), rm); d.position.set(x, H(x, z) + 8, z); d.rotation.y = -Math.atan(0.00004 * (x - M[0])); W.road.add(d); }
    W.boat = new T.Mesh(new T.BoxGeometry(260, 14, 100), new T.MeshBasicMaterial({ color: 0xffe07a })); W.road.add(W.boat);
    // うなぎの稚魚(模式。光る点が海から口を通って湖へ)
    const gt = glow(); W.eels = []; for (let i = 0; i < 70; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: gt, color: 0xbff0ff, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sp.scale.setScalar(260); s.add(sp); W.eels.push(sp); }
  }
  function lakeState(o) {
    const br = o.breach ?? 1; // 0 = ふさがっている、1 = 切れた
    W.bar.forEach((b, i) => { const sx = i ? 1 : -1, k = br; b.visible = k < 0.999; b.position.x = M[0] + sx * (420 + 380 * k); b.scale.set(Math.max(1, 520 * (1 - k * 0.7)), 1, 650 * (1 - k * 0.3)); });
    W.waterMat.color.copy(W.freshCol).lerp(W.seaCol, o.salt ?? 1);
    W.wave.visible = o.wave !== undefined && o.wave < 1; if (W.wave.visible) { const z = 16000 - (16000 - M[1] + 1500) * o.wave; W.wave.position.set(M[0], 7, z); W.wave.material.opacity = 0.75 * (1 - Math.max(0, o.wave - 0.85) / 0.15); }
    W.mouth.visible = o.width !== undefined; if (W.mouth.visible) W.mouth.scale.x = o.width;
    W.road.visible = !!o.road; if (o.road) { const u = o.road; W.boat.position.set(M[0] - 500 + 1000 * u, 6, M[1] - 900); }
    W.eels.forEach((e, i) => { e.visible = o.eels !== undefined; if (!e.visible) return; const ph = (o.eels * 1.6 + i / W.eels.length) % 1, side = ((i * 37) % 11 - 5) / 5;
      const P = ph < 0.45 ? mix([M[0] + side * 900, 10, M[1] + 5000], [M[0], 10, M[1]], ph / 0.45) : mix([M[0], 10, M[1]], [M[0] - 2500 + side * 3000, 10, M[1] - 9000 + Math.abs(side) * 2000], (ph - 0.45) / 0.55);
      e.position.set(...P); e.material.opacity = Math.min(1, ph * 6, (1 - ph) * 6); });
  }

  /* ---- 地球(近江と遠江) ---- */
  const R = 10, D2R = Math.PI / 180;
  const ll = (lat, lon, r = R) => { const ph = (90 - lat) * D2R, th = (lon + 180) * D2R; return new T.Vector3(-r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); };
  function buildGlobe() {
    const s = set("globe"); s.add(new T.Mesh(new T.SphereGeometry(R, 256, 128), new T.MeshStandardMaterial({ map: A.earth, roughness: 0.85 })));
    const gt = glow(); W.dots = [[35.01, 135.77, 0xffe07a], [35.25, 136.08, 0x7fd0ff], [34.75, 137.58, 0x7fd0ff]].map(([la, lo, c]) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: gt, color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sp.scale.setScalar(0.035); sp.position.copy(ll(la, lo, R * 1.001)); s.add(sp); return sp; });
  }

  window.WORLD = {
    async preload() {
      T = THREE;
      A.sky = await tex("env/sky_puresky_4k.jpg", true); A.sky.mapping = T.EquirectangularReflectionMapping;
      A.earth = await tex("earth/earth_blue_marble_4k.jpg", true); A.earth.anisotropy = 16;
      A.hama = await AutoAssets.loadTerrain("hamanako", { coastZ: 9000 });
    },
    init(G) {
      g = G; T = g.T;
      const rd = g.renderer; rd.outputEncoding = T.sRGBEncoding; rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = 0.85;
      envSky = new T.PMREMGenerator(rd).fromEquirectangular(A.sky).texture;
      sun = new T.DirectionalLight(0xfff1dc, 1.5); g.scene.add(sun, sun.target); g.scene.add(new T.HemisphereLight(0xdfe8ff, 0x3a3a3a, 0.25));
      buildLake(); buildGlobe();
    },
    update(id, p, t, dur) {
      const { ease, seg, out, screen, label } = g;
      const far = (k, a0 = -0.2) => { const a = a0 + 0.25 * k; return [Math.sin(a) * 15000, 13000 - 1500 * k, 2500 + Math.cos(a) * 15000]; };
      const near = [M[0] + 2600, 3200, M[1] + 5200];
      if (id === "s1") { // 現在の浜名湖から、昔へ
        show("lake"); lakeState({ breach: 1 - ease(seg(p, 0.55, 0.95)), salt: 1 - ease(seg(p, 0.55, 0.95)) });
        cam(far(ease(p)), [0, 0, -1500]); screen(p < 0.55 ? "現在" : "約500年前", 270, 150, { size: 46 });
      } else if (id === "s2") { // 砂の堤で仕切られた淡水の湖
        show("lake"); lakeState({ breach: 0, salt: 0 }); cam(mix(far(1), near, ease(seg(p, 0, 0.5))), mix([0, 0, -1500], [M[0], 0, M[1] - 1500], ease(seg(p, 0, 0.5))));
        if (p > 0.3) label("砂の堤", [M[0], 10, M[1]], { size: 30, dy: -30, alpha: out(seg(p, 0.3, 0.4)) });
        screen("淡水の湖", 270, 150, { size: 42 });
      } else if (id === "s3") { // 近江と遠江
        show("globe"); const c = ll(35.0, 136.7), eye = ll(32.5 - 0.8 * p, 136.7, R * (1.2 - 0.03 * ease(p)));
        g.camera.up.set(0, 1, 0); cam([eye.x, eye.y, eye.z], [c.x, c.y, c.z], 40); sun.position.copy(eye.clone().multiplyScalar(6)); sun.target.position.set(0, 0, 0);
        const lb = (la, lo, text, o) => { const v = ll(la, lo, R); label(text, [v.x, v.y, v.z], Object.assign({ size: 26 }, o)); };
        lb(35.01, 135.77, "都", { dy: 30 }); if (p > 0.2) lb(35.25, 136.08, "近江(琵琶湖)", { dy: -30, alpha: out(seg(p, 0.2, 0.3)) }); if (p > 0.5) lb(34.75, 137.58, "遠江(浜名湖)", { dy: -30, alpha: out(seg(p, 0.5, 0.6)) });
      } else if (id === "s4") { // 1498 年、津波が砂の堤を切る
        show("lake"); const w = seg(p, 0.05, 0.6); lakeState({ breach: ease(seg(p, 0.5, 0.8)), salt: ease(seg(p, 0.6, 1)), wave: w });
        cam([M[0] + 7000, 6500, M[1] + 12000], [M[0], 0, M[1] - 500]); screen("1498年 明応地震", 270, 150, { size: 42 });
      } else if (id === "s5") { // 今、切れた
        show("lake"); lakeState({ breach: 1, salt: 1 }); const k = ease(p); cam(mix(near, [M[0] + 900, 1300, M[1] + 2200], k), [M[0], 0, M[1] - 200]);
        label("今切", [M[0], 10, M[1]], { size: 40, dy: -40 });
      } else if (id === "s6") { // 東海道は舟で渡る
        show("lake"); lakeState({ breach: 1, salt: 1, road: seg(p, 0.2, 0.9) }); cam([M[0] + 1500, 6500, M[1] + 9000], [M[0] - 500, 0, M[1] - 1500]);
        label("東海道", [M[0] + 1300, 20, M[1] - 900 + 0.00002 * 1300 * 1300], { size: 30, dy: -34 }); if (p > 0.3) label("今切の渡し", [M[0], 20, M[1] - 900], { size: 26, dy: 34, alpha: out(seg(p, 0.3, 0.4)) });
      } else if (id === "s7") { // 1854 年、口が 360 m → 1260 m
        show("lake"); const k = ease(seg(p, 0.25, 0.75)), w = 360 + 900 * k; lakeState({ breach: 1, salt: 1, width: w });
        cam([M[0] + 1200, 2600, M[1] + 3800], [M[0], 0, M[1] - 300]); screen("1854年", 270, 150, { size: 44 }); screen(`口の幅 ${Math.round(w / 10) * 10}m`, 270, 210, { size: 38 }); screen("(幅の変化は模式)", 270, 912, { size: 17, weight: 700 });
      } else if (id === "s8") { // 1956 年に 200 m で固定(今の地形そのもの)
        show("lake"); lakeState({ breach: 1, salt: 1 }); const k = ease(p); cam(mix([M[0] + 1200, 2600, M[1] + 3800], [M[0] + 500, 900, M[1] + 1500], k), [M[0], 0, M[1] - 200]);
        screen("1956年", 270, 150, { size: 44 }); if (p > 0.3) label("200m", [M[0], 10, M[1]], { size: 34, dy: -34, alpha: out(seg(p, 0.3, 0.4)) });
      } else if (id === "s9") { // うなぎの稚魚が海から入る
        show("lake"); lakeState({ breach: 1, salt: 1, eels: p }); cam([M[0] + 4000, 9000, M[1] + 12000], [M[0] - 1000, 0, M[1] - 3500]);
        if (p > 0.25) screen("うなぎの稚魚(模式)", 270, 150, { size: 36, alpha: out(seg(p, 0.25, 0.35)) });
      } else if (id === "s10") { // 引いて全体
        show("lake"); lakeState({ breach: 1, salt: 1 }); cam(far(1 - ease(p) * 0.6, -0.1), [0, 0, -1500]);
        label("浜名湖", [-1500, 0, -800], { size: 34 });
      }
    },
  };
})();
