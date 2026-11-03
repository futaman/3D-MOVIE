/* 物理モデル(表示から切り離した純粋関数)。ブラウザでは window.MOSPhys、Node では module.exports。 */
(function (root) {
  "use strict";

  /* ---- 定数(シリコン、300 K) ---- */
  const Q = 1.602e-19;            // 電気素量 [C]
  const EPS0 = 8.854e-14;         // 真空の誘電率 [F/cm]
  const EPS_SI = 11.7 * EPS0;     // シリコンの誘電率 [F/cm]
  const VT = 0.02585;             // 熱電圧 kT/q [V]
  const NI = 1.0e10;              // 真性キャリア密度 [cm^-3]

  /* ---- 原子(ボーア模型での殻ごとの電子数) ---- */
  const ATOMS = {
    Si: { name: "シリコン", Z: 14, shells: [2, 8, 4] },
    P:  { name: "リン",     Z: 15, shells: [2, 8, 5] },
    B:  { name: "ホウ素",   Z: 5,  shells: [2, 3] },
  };
  function atomCharge(Z, boundElectrons, freedElectrons) {
    return { atom: Z - boundElectrons, freed: -freedElectrons, total: Z - boundElectrons - freedElectrons };
  }

  /* ---- MOSFET(二乗則、教育用の簡易値) ---- */
  const VTH0 = 2.0;               // しきい値電圧 [V](V_SB = 0)
  const K = 0.10;                 // μnCox·W/L [A/V^2]
  const GAMMA = 0.5;              // 基板バイアス係数 [V^0.5]
  const PHI2 = 0.7;               // 2φF [V]
  function vthOf(vsb = 0) { return VTH0 + GAMMA * (Math.sqrt(PHI2 + vsb) - Math.sqrt(PHI2)); }
  function idMos(vgs, vds, vth = VTH0) {
    const vov = vgs - vth;
    if (vov <= 0 || vds <= 0) return 0;
    if (vds < vov) return K * (vov * vds - vds * vds / 2);
    return K / 2 * vov * vov;
  }
  function region(vgs, vds, vth = VTH0) {
    const vov = vgs - vth;
    if (vov <= 0) return "cut";
    return vds < vov ? "lin" : "sat";
  }
  // チャネル内の反転電荷 ∝ q(xf)。xf: 0 = ソース、1 = ドレイン(グラデュアル・チャネル近似)
  function channelQ(vgs, vds, xf, vth = VTH0) {
    const vov = vgs - vth;
    if (vov <= 0) return 0;
    const ve = Math.min(vds, vov);
    const c = vov * ve - ve * ve / 2;
    return Math.sqrt(Math.max(0, vov * vov - 2 * xf * c));
  }
  // LED 回路: 5 V → 150 Ω → 赤色 LED(V_F 2.0 V)→ MOSFET(D→S)→ GND
  const LED = { VDD: 5, VF: 2.0, R: 150 };
  function ledCircuit(vgs) {
    let lo = 0, hi = LED.VDD - LED.VF;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      const f = idMos(vgs, m) - (LED.VDD - LED.VF - m) / LED.R;
      if (f > 0) hi = m; else lo = m;
    }
    const vds = (lo + hi) / 2;
    return { vds, id: Math.max(0, (LED.VDD - LED.VF - vds) / LED.R) };
  }

  /* ---- PN 接合(1 次元・階段接合・空乏近似) ---- */
  // NA, ND [cm^-3]、va: 印加電圧 [V](順方向が正)
  function pn(NA, ND, va = 0) {
    const vbi = VT * Math.log(NA * ND / (NI * NI));
    const v = Math.max(vbi - va, 1e-9);
    const W = Math.sqrt(2 * EPS_SI * v / Q * (1 / NA + 1 / ND));  // [cm]
    const xn = W * NA / (NA + ND), xp = W * ND / (NA + ND);       // N_A·x_p = N_D·x_n
    const Emax = Q * ND * xn / EPS_SI;                             // [V/cm]
    return { NA, ND, vbi, v, W, xn, xp, Emax, sheet: ND * xn };    // sheet: 片側のイオン数 [cm^-2]
  }
  // 位置 x [cm](p 側が負、接合が 0)での電荷密度 rho [C/cm^3]、電場 E [V/cm](+x 向きが正)、電位 V [V](p 側の外を 0)
  function pnAt(p, x) {
    const a = Q * p.NA / EPS_SI, d = Q * p.ND / EPS_SI;
    if (x <= -p.xp) return { rho: 0, E: 0, V: 0 };
    if (x >= p.xn) return { rho: 0, E: 0, V: p.v };
    if (x < 0) return { rho: -Q * p.NA, E: -a * (x + p.xp), V: a / 2 * (x + p.xp) ** 2 };
    return { rho: Q * p.ND, E: -d * (p.xn - x), V: p.v - d / 2 * (p.xn - x) ** 2 };
  }

  const api = { Q, EPS0, EPS_SI, VT, NI, ATOMS, atomCharge, VTH0, K, GAMMA, PHI2, vthOf, idMos, region, channelQ, LED, ledCircuit, pn, pnAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MOSPhys = api;
})(typeof window !== "undefined" ? window : globalThis);
