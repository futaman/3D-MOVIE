// node --test apps/sims/mosfet/core/physics.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("./physics.js");

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test("原子はどれも中性", () => {
  for (const k of Object.keys(P.ATOMS)) {
    const a = P.ATOMS[k];
    assert.equal(a.shells.reduce((s, n) => s + n, 0), a.Z, k);
    assert.equal(P.atomCharge(a.Z, a.Z, 0).total, 0);
  }
  const ion = P.atomCharge(14, 13, 1);
  assert.equal(ion.atom, 1);
  assert.equal(ion.total, 0);
});

test("PN 接合: 仕様書の数値例(N_A = N_D = 1e16)", () => {
  const p = P.pn(1e16, 1e16);
  near(p.vbi, 0.716, 0.005, "内蔵電位 [V]");
  near(p.W * 1e4, 0.43, 0.01, "空乏層の幅 [µm]");
  near(p.Emax, 3.3e4, 0.1e4, "最大電場 [V/cm]");
});

test("PN 接合: 両側の電荷は等しく、薄い側に広がる", () => {
  const p = P.pn(1e15, 1e17);
  near(p.NA * p.xp, p.ND * p.xn, 1e-6 * p.NA * p.xp, "電荷のつり合い");
  assert.ok(p.xp > p.xn * 50, "薄い p 側に深く広がる");
});

test("PN 接合: 電場と電位がつながっている", () => {
  const p = P.pn(3e15, 2e16);
  near(Math.abs(P.pnAt(p, 0).E), p.Emax, p.Emax * 1e-9, "接合で最大");
  near(P.pnAt(p, -1e-12).V, P.pnAt(p, 1e-12).V, 1e-6, "電位は接合で連続");
  near(P.pnAt(p, p.xn).V, p.vbi, 1e-9, "段差 = 内蔵電位");
  assert.ok(P.pnAt(p, -p.xp / 2).E < 0 && P.pnAt(p, p.xn / 2).E < 0, "電場は n → p 向き(−x)");
});

test("PN 接合: 逆バイアスで空乏層が広がる", () => {
  assert.ok(P.pn(1e16, 1e16, -3).W > P.pn(1e16, 1e16, 0).W * 2);
});

test("MOSFET: 線形と飽和の境目で連続", () => {
  const vgs = 3.7, vov = vgs - P.VTH0;
  near(P.idMos(vgs, vov - 1e-9), P.idMos(vgs, vov + 1e-9), 1e-8, "I_D");
  assert.equal(P.idMos(1.9, 3), 0);
  assert.equal(P.region(3, 2), "sat");
});

test("MOSFET: 基板バイアスでしきい値が上がる", () => {
  assert.equal(P.vthOf(0), P.VTH0);
  near(P.vthOf(2.5), 2.476, 0.002, "V_th(V_SB = 2.5 V)");
});

test("LED 回路: キルヒホッフの法則を満たす", () => {
  for (const vgs of [0, 2.2, 2.5, 3, 5]) {
    const r = P.ledCircuit(vgs);
    near(P.idMos(vgs, r.vds), r.id, 1e-6, `V_GS = ${vgs}`);
  }
  near(P.ledCircuit(5).id, 0.02, 0.0006, "全開で約 20 mA(MOSFET の電圧降下ぶん少し減る)");
});

test("チャネル電荷: ピンチオフでドレイン端が 0", () => {
  near(P.channelQ(4, 3, 1), 0, 1e-9, "飽和");
  near(P.channelQ(4, 0, 1), 2, 1e-9, "V_DS = 0 では一様");
});
