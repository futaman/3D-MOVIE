/* 全章で使う表現の部品(window.MOSKit)。Three.js r128 の UMD 版が先に読み込まれている前提。 */
(function () {
  "use strict";
  const T = THREE;
  const K = {};

  K.C = (h) => new T.Color(h);
  K.V = (x, y, z) => new T.Vector3(x, y, z);
  K.css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  K.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  K.smooth = (a, b, x) => { const t = K.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  K.rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

  // 本文中の記号を添字つきに
  K.sub = (t) => String(t)
    .replace(/V_(GS|DS|SB|th0|th|bi)/g, "V<sub>$1</sub>")
    .replace(/I_(D|G)/g, "I<sub>$1</sub>")
    .replace(/E_max/g, "E<sub>max</sub>")
    .replace(/N_(A|D)/g, "N<sub>$1</sub>")
    .replace(/x_(n|p)/g, "x<sub>$1</sub>");

  /* ---- 形と材質 ---- */
  K.mat = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: K.C(color), roughness: 0.6, metalness: 0.1 }, o));
  K.glass = (color, opacity) => new T.MeshStandardMaterial({ color: K.C(color), transparent: true, opacity, depthWrite: false, roughness: 0.2, metalness: 0 });
  K.box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; };
  K.edges = (mesh, color, opacity = 0.5) => {
    const l = new T.LineSegments(new T.EdgesGeometry(mesh.geometry), new T.LineBasicMaterial({ color: K.C(color), transparent: true, opacity }));
    l.position.copy(mesh.position); l.rotation.copy(mesh.rotation); return l;
  };
  K.polyline = (points) => {
    const path = new T.CurvePath();
    for (let i = 0; i < points.length - 1; i++) path.add(new T.LineCurve3(points[i], points[i + 1]));
    return path;
  };

  /* ---- インスタンス描画 ---- */
  const dummy = new T.Object3D();
  K.dummy = dummy;
  K.inst = (geo, mat, n) => { const m = new T.InstancedMesh(geo, mat, n); m.frustumCulled = false; return m; };
  K.put = (mesh, i, x, y, z, s = 1, rz = 0, sx = s) => {
    dummy.position.set(x, y, z); dummy.rotation.set(0, 0, rz); dummy.scale.set(sx, s, s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  };
  K.hide = (mesh, i) => K.put(mesh, i, 0, -999, 0, 0.0001);

  // 粒子の共通表現: 電子 = 水色の球、正孔 = 珊瑚色の輪(電子の空席)、イオン = 揺れない＋/− 記号
  K.electronMat = () => new T.MeshStandardMaterial({ color: K.C("#5fe1f5"), emissive: K.C("#2bc4e0"), emissiveIntensity: 0.7, roughness: 0.4 });
  K.holeMat = () => new T.MeshStandardMaterial({ color: K.C("#ff8a75"), emissive: K.C("#ff5a40"), emissiveIntensity: 0.45, roughness: 0.5 });
  K.electronGeo = (r = 0.07) => new T.SphereGeometry(r, 10, 8);
  K.holeGeo = (r = 0.075) => new T.TorusGeometry(r, r * 0.3, 6, 18);
  // 符号: 「−」は横棒 1 本、「＋」は横棒 + 縦棒
  K.signs = (n, color, plus, size = 0.17) => {
    const m = new T.MeshBasicMaterial({ color: K.C(color) });
    const h = K.inst(new T.BoxGeometry(size, size * 0.22, size * 0.22), m, n);
    const v = plus ? K.inst(new T.BoxGeometry(size * 0.22, size, size * 0.22), m, n) : null;
    const g = new T.Group(); g.add(h); if (v) g.add(v);
    return {
      group: g,
      set(i, x, y, z, s = 1) { K.put(h, i, x, y, z, s); if (v) K.put(v, i, x, y, z, s); },
      hide(i) { K.hide(h, i); if (v) K.hide(v, i); },
      done() { h.instanceMatrix.needsUpdate = true; if (v) v.instanceMatrix.needsUpdate = true; },
    };
  };

  /* ---- 電場の矢印(長さと明るさ = 強さ)。向きは x 軸方向のみ(1 次元の電場) ---- */
  K.fieldArrows = (n, color = "#eaf3f5") => {
    const mat = new T.MeshBasicMaterial({ color: K.C(color), transparent: true, opacity: 0.85, depthWrite: false });
    const shaftGeo = new T.CylinderGeometry(0.018, 0.018, 1, 6); shaftGeo.rotateZ(Math.PI / 2); shaftGeo.translate(0.5, 0, 0);
    const headGeo = new T.ConeGeometry(0.06, 0.16, 10); headGeo.rotateZ(-Math.PI / 2);
    const shaft = K.inst(shaftGeo, mat, n), head = K.inst(headGeo, mat, n);
    shaft.renderOrder = head.renderOrder = 9;
    const g = new T.Group(); g.add(shaft, head);
    return {
      group: g,
      // (x, y, z) を中心に、長さ len、dir = +1(+x 向き)/ −1(−x 向き)
      set(i, x, y, z, len, dir) {
        if (len < 0.04) { K.hide(shaft, i); K.hide(head, i); return; }
        const body = Math.max(0.001, len - 0.14), x0 = x - dir * len / 2;
        dummy.position.set(x0, y, z); dummy.rotation.set(0, dir > 0 ? 0 : Math.PI, 0); dummy.scale.set(body, 1, 1); dummy.updateMatrix(); shaft.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x0 + dir * (body + 0.07), y, z); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); head.setMatrixAt(i, dummy.matrix);
      },
      hide(i) { K.hide(shaft, i); K.hide(head, i); },
      done() { shaft.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true; },
    };
  };

  /* ---- 2D グラフ用のキャンバス ---- */
  K.canvas2d = (cv) => {
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    if (r.width && (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr))) {
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    }
    const ctx = cv.getContext("2d"), W = cv.width / dpr, H = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.lineWidth = 1;
    return { ctx, W, H };
  };

  window.MOSKit = K;
  window.MOS = window.MOS || { chapters: {} };
})();
