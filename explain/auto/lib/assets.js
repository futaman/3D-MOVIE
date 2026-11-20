/* assets.js — GLB アセットの読み込み部品 (Three.js r128 / file:// でも動く)。
 *
 *   <script src="vendor/three.min.js"></script>
 *   <script src="vendor/GLTFLoader.js"></script>   ← 無ければ自動で差し込む
 *   <script src="assets.js"></script>
 *
 *   const ch = await AutoAssets.loadCharacter();          // 既定は "keisan"
 *   scene.add(ch.root);
 *   ch.play("throw", 0.5);                                // 0.5 秒時点の姿勢 (壁時計は使わない)
 *   ch.blend("idle", t, "wave", t, 0.3);                  // 2 クリップの合成 (weight=0 で A、1 で B)
 *   ch.handR.getWorldPosition(v);                         // 右の手のひら (hand_R_attach)
 *
 * file:// では fetch / XHR が使えないので、GLB は base64 を入れた JS (<name>.glb.js) を <script> で読む。
 * http(s) で配る場合は <name>.glb を fetch する経路に自動で落ちる。
 */
(function () {
  "use strict";
  var T = window.THREE;
  var here = (document.currentScript && document.currentScript.src) || location.href;
  var LIB = here.replace(/[^\/]*$/, "");
  var DIRS = { keisan: "../assets/character/", paper_plane: "../assets/character/", human01: "../assets/human01/",
    torii: "../assets/hamanako_props/", ferris_wheel: "../assets/hamanako_props/", coaster: "../assets/hamanako_props/" };

  function addScript(url) {
    return new Promise(function (ok, ng) {
      var s = document.createElement("script"); s.src = url; s.onload = ok;
      s.onerror = function () { ng(new Error("script load failed: " + url)); };
      document.head.appendChild(s);
    });
  }
  function b64ToBuffer(b64) {
    var bin = atob(b64), n = bin.length, u8 = new Uint8Array(n);
    for (var i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  }
  function data() { return window.AUTO_ASSET_DATA || {}; }
  function dirOf(name, opts) { return (opts && opts.baseUrl) || LIB + (DIRS[name] || "../assets/character/"); }

  // GLB のバイト列を得る: 同梱済み → <name>.glb.js を差し込む → fetch の順
  function loadBytes(name, opts) {
    var key = name + ".glb", dir = dirOf(name, opts);
    if (data()[key]) return Promise.resolve(b64ToBuffer(data()[key]));
    return addScript(dir + key + ".js").then(function () {
      if (!data()[key]) throw new Error(key + ".js did not define the asset");
      return b64ToBuffer(data()[key]);
    }).catch(function () {
      return fetch(dir + key).then(function (r) { if (!r.ok) throw new Error("fetch " + key + " " + r.status); return r.arrayBuffer(); });
    });
  }
  function loadGLTF(name, opts) {
    var need = T.GLTFLoader ? Promise.resolve() : addScript(LIB + "vendor/GLTFLoader.js");
    return need.then(function () { return loadBytes(name, opts); }).then(function (buf) {
      return new Promise(function (ok, ng) { new T.GLTFLoader().parse(buf, "", ok, ng); });
    });
  }
  function prep(root, opts) {
    root.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = !(opts && opts.castShadow === false); o.receiveShadow = !!(opts && opts.receiveShadow);
      if (o.isSkinnedMesh) o.frustumCulled = false;   // 境界は静止姿勢のままなので、切り落とされないようにする
    });
  }

  // 骨なしの小物 (paper_plane など)。THREE.Group を返す
  function loadModel(name, opts) {
    return loadGLTF(name, opts).then(function (g) { prep(g.scene, opts); var root = new T.Group(); root.name = name; root.add(g.scene); return root; });
  }

  function loadCharacter(name, opts) {
    if (name && typeof name === "object") { opts = name; name = null; }
    name = name || "keisan";
    return loadGLTF(name, opts).then(function (g) {
      var root = new T.Group(); root.name = name; root.add(g.scene); prep(g.scene, opts);
      var meta = data()[name + ".meta"] || {}, metaClips = meta.clips || {};
      var nodes = {}, rest = [];
      g.scene.traverse(function (o) {
        if (o.name) nodes[o.name] = o;
        rest.push({ o: o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
      });
      var clips = {};
      g.animations.forEach(function (clip) {
        var tr = [];
        clip.tracks.forEach(function (t) {
          var i = t.name.lastIndexOf("."), node = nodes[t.name.slice(0, i)], prop = t.name.slice(i + 1);
          if (!node || prop === "scale") return;      // scale は常に 1 なので読まない
          tr.push({ node: node, prop: prop, it: t.createInterpolant(undefined) });
        });
        var m = metaClips[clip.name] || {};
        clips[clip.name] = { name: clip.name, duration: m.duration || clip.duration, loop: !!m.loop, tracks: tr };
      });
      function clipOf(n) { var c = clips[n]; if (!c) throw new Error("unknown clip: " + n + " (have: " + Object.keys(clips).join(", ") + ")"); return c; }
      function timeIn(c, t, loop) {
        var d = c.duration; if (loop === undefined) loop = c.loop;
        if (loop) { t = t % d; if (t < 0) t += d; return t; }
        return Math.min(Math.max(t, 0), d);
      }
      function reset() { for (var i = 0; i < rest.length; i++) { var r = rest[i]; r.o.position.copy(r.p); r.o.quaternion.copy(r.q); r.o.scale.copy(r.s); } }
      var q = new T.Quaternion(), v = new T.Vector3();
      // w=1 でそのまま書き込み、w<1 で今の値に向けて混ぜる
      function apply(c, t, w) {
        for (var i = 0; i < c.tracks.length; i++) {
          var k = c.tracks[i], r = k.it.evaluate(t);
          if (k.prop === "quaternion") { q.set(r[0], r[1], r[2], r[3]); if (w >= 1) k.node.quaternion.copy(q); else k.node.quaternion.slerp(q, w); }
          else if (k.prop === "position") { v.set(r[0], r[1], r[2]); if (w >= 1) k.node.position.copy(v); else k.node.position.lerp(v, w); }
        }
      }
      function play(clipName, timeSec, o) {
        var c = clipOf(clipName); reset(); apply(c, timeIn(c, timeSec || 0, o && o.loop), 1); root.updateMatrixWorld(true); return api;
      }
      function blend(clipA, tA, clipB, tB, weight, o) {
        var a = clipOf(clipA), b = clipOf(clipB), w = Math.min(Math.max(weight, 0), 1);
        reset(); apply(a, timeIn(a, tA || 0, o && o.loopA), 1);
        if (w > 0) apply(b, timeIn(b, tB || 0, o && o.loopB), w);
        root.updateMatrixWorld(true); return api;
      }
      var info = {};
      Object.keys(clips).forEach(function (k) { info[k] = { duration: clips[k].duration, loop: clips[k].loop }; });
      var api = {
        root: root, play: play, blend: blend, reset: function () { reset(); root.updateMatrixWorld(true); return api; },
        handR: nodes.hand_R_attach || nodes.hand_R, head: nodes.head, bones: nodes, clips: info,
        releaseTime: meta.throw_release_time, meta: meta,
      };
      if (clips.idle) play("idle", 0);
      return api;
    });
  }

  /* ---- 地形 (assets/<name>/ の色・高さ・水域の画像から)。1 = 1 m、x = 東、z = 南、原点は meta の center ----
   *   const tr = await AutoAssets.loadTerrain("hamanako");   scene.add(tr.root);   tr.heightAt(x, z)
   * file:// で画像を WebGL / canvas に使うので、Chromium は --allow-file-access-from-files で起動する。 */
  var TERRAIN_DIRS = { hamanako: "../assets/hamanako/" };
  function loadImage(url) { return new Promise(function (ok, ng) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ng(new Error("image load failed: " + url)); }; i.src = url; }); }
  function pixels(im) { var c = document.createElement("canvas"); c.width = im.width; c.height = im.height; var x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; }
  function loadTerrain(name, opts) {
    opts = opts || {}; var dir = (opts.baseUrl) || LIB + (TERRAIN_DIRS[name] || "../assets/" + name + "/");
    return addScript(dir + name + ".meta.js").then(function () {
      return Promise.all([loadImage(dir + name + "_color.jpg"), loadImage(dir + name + "_height.png"), loadImage(dir + name + "_water.png")]);
    }).then(function (ims) {
      var meta = data()[name + ".meta"], S = meta.size_m, seg = opts.segments || 511, ex = opts.exaggerate || 1, fade = opts.edgeFade || 4000, coast = opts.coastZ;
      var hp = pixels(ims[1]), hw = ims[1].width, wp = pixels(ims[2]), ww = ims[2].width;
      function bil(a, w, u, v, f) { var x = u * (w - 1), y = v * (w - 1), x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, w - 1), fx = x - x0, fy = y - y0;
        return (f(a, (y0 * w + x0) * 4) * (1 - fx) + f(a, (y0 * w + x1) * 4) * fx) * (1 - fy) + (f(a, (y1 * w + x0) * 4) * (1 - fx) + f(a, (y1 * w + x1) * 4) * fx) * fy; }
      var dem = function (a, i) { return (a[i] * 256 + a[i + 1]) / 50 - 100; }, wet = function (a, i) { return a[i] / 255; };
      var sstep = function (a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
      function heightAt(x, z) {
        var u = x / S + 0.5, v = z / S + 0.5; if (u < 0 || u > 1 || v < 0 || v > 1) return 0.5;
        var land = Math.max(bil(hp, hw, u, v, dem), 0) * ex + 0.8, w = sstep(0.3, 0.7, bil(wp, ww, u, v, wet)), h = land * (1 - w) - 5 * w;
        var k = sstep(0, 1, Math.min(x + S / 2, S / 2 - x, z + S / 2, S / 2 - z) / fade);   // 端は低くして外の平地につなぐ
        return h * k + (w > 0.5 ? -5 : 0.5) * (1 - k);
      }
      var root = new T.Group(); root.name = name;
      var geo = new T.PlaneGeometry(S, S, seg, seg).rotateX(-Math.PI / 2), pos = geo.attributes.position;
      for (var i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
      geo.computeVertexNormals();
      var map = new T.Texture(ims[0]); map.encoding = T.sRGBEncoding; map.anisotropy = 16; map.needsUpdate = true;
      var ground = new T.Mesh(geo, new T.MeshStandardMaterial({ map: map, roughness: 0.95, metalness: 0, envMapIntensity: 0.55 })); ground.receiveShadow = true; root.add(ground);
      // 範囲の外: 北・東・西は平地、南(coastZ より南)は海
      var outer = 150000, far = new T.MeshStandardMaterial({ color: new T.Color(opts.farColor || 0x3a5233).convertSRGBToLinear(), roughness: 1, envMapIntensity: 0.4 }), cz = coast === undefined ? S / 2 : coast;
      [[-outer, -S / 2, -outer, cz], [S / 2, outer, -outer, cz], [-S / 2, S / 2, -outer, -S / 2]].forEach(function (r) {
        var m = new T.Mesh(new T.PlaneGeometry(r[1] - r[0], r[3] - r[2]).rotateX(-Math.PI / 2), far); m.position.set((r[0] + r[1]) / 2, 0.5, (r[2] + r[3]) / 2); root.add(m); });
      var bed = new T.Mesh(new T.PlaneGeometry(outer * 2, outer * 2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x0a1c22 })); bed.position.y = -8; root.add(bed);
      var water = new T.Mesh(new T.PlaneGeometry(outer * 2, outer * 2).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: new T.Color(opts.waterColor || 0x123543).convertSRGBToLinear(), roughness: 0.1, metalness: 0, transparent: true, opacity: 0.8, envMapIntensity: 1.1, depthWrite: false }));
      water.renderOrder = 1; root.add(water);   // 影は受けない(広い板だと影の縞が出る)。細かい波の法線マップはソフトウェア描画で縞になるので付けない
      return { root: root, ground: ground, water: water, heightAt: heightAt, meta: meta };
    });
  }

  window.AutoAssets = { loadCharacter: loadCharacter, loadModel: loadModel, loadGLTF: loadGLTF, loadTerrain: loadTerrain };
})();
