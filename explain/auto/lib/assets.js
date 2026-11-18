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
  var DIRS = { keisan: "../assets/character/", paper_plane: "../assets/character/", human01: "../assets/human01/" };

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

  window.AutoAssets = { loadCharacter: loadCharacter, loadModel: loadModel, loadGLTF: loadGLTF };
})();
