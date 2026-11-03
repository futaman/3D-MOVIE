/* E 確認: 確かめよう */
(() => {
  "use strict";
  const K = MOSKit;
  const QUIZ = [
    { part: "材料", q: "シリコン原子から電子を 1 個はがしました。残ったイオンと、はがした電子を合わせた電荷は？", a: ["＋1", "0", "−1"], ok: 1,
      why: "イオンは＋1、はがした電子は−1。合計は 0 のままです。電荷は消えたり生まれたりせず、場所が分かれるだけです。" },
    { part: "材料", q: "リンを入れた n 型シリコンのかけらは、全体として帯電している？", a: ["＋に帯電している", "−に帯電している", "全体としては中性"], ok: 2,
      why: "リンは＋イオンになりますが、手放した電子も結晶の中にいます。数が同じなので、結晶全体は中性です。" },
    { part: "接合", q: "PN 接合の空乏層の中に、電子を 1 個置くとどうなる？", a: ["その場にとどまる", "電場に押されて n 側へ運ばれる", "p 側へ運ばれる"], ok: 1,
      why: "空乏層には、n 側の＋イオンから p 側の−イオンへ向かう電場があります。電子は電場と逆向き、つまり n 側へ押されます。" },
    { part: "接合", q: "空乏層の本質としていちばん大事なのは？", a: ["キャリアが 1 個もないこと", "取り残されたイオンの電荷がつくる電場があること", "電流がよく流れること"], ok: 1,
      why: "キャリアが去ったことで、動けないイオンの電荷がむき出しになり、電場が生まれます。拡散とこの電場による押し戻しが釣り合っています。" },
    { part: "MOS", q: "ゲートにほとんど電流が流れないのはなぜ？", a: ["ゲートの下が薄い酸化膜(絶縁体)で仕切られているから", "ゲートの金属がとても細いから", "電子はゲートに近づけないから"], ok: 0,
      why: "ゲートと半導体の間は酸化膜で絶縁されています。ゲートは電流ではなく電場で、下の電子や正孔を動かします。" },
    { part: "MOS", q: "ゲートに＋をかけたとき、表面に集まってチャネルになる電子はどこから来る？", a: ["ゲートから酸化膜を通って", "ソースやドレインの n⁺ 領域から", "基板の裏の電極から"], ok: 1,
      why: "酸化膜は電子を通しません。ゲートの電場に引き寄せられた電子は、すぐ横の n⁺ 領域から供給されます。" },
    { part: "MOS", q: "V_GS がしきい値(この模型では 2.0 V)より低いとき、どうなる？", a: ["電流は大きく流れる", "チャネルができず、電流はほぼ流れない", "ゲートに大きな電流が流れる"], ok: 1,
      why: "しきい値に届くまでは、正孔が押しのけられた空乏層ができるだけで、電子の通り道はまだありません。" },
    { part: "MOS", q: "ピンチオフした後も電流が流れ続けるのはなぜ？", a: ["電子がゲートから補充されるから", "ピンチオフ点からドレインまでの強い電場が電子を運ぶから", "基板から電流が流れ込むから"], ok: 1,
      why: "チャネルが閉じた先の短い区間には強い電場がかかっていて、そこまで来た電子をドレインへ運びます。増えた V_DS はこの区間にかかるだけなので、電流はほぼ一定になります。" },
    { part: "MOS", q: "n チャネル MOSFET で、基板 B をソース S より低い電圧にする(V_SB > 0)と、しきい値 V_th は？", a: ["上がる", "下がる", "変わらない"], ok: 0,
      why: "空乏層が深くなって負の固定電荷が増え、その分ゲートの電場が受け止められます。チャネルをつくるのに、より高い V_GS が必要になります。" },
  ];
  const PART_CH = { 材料: "atom", 接合: "pn", MOS: "channel" };

  MOS.chapters.quiz = {
    id: "quiz", part: "E", title: "確かめよう", scale: "確認問題", overlay: true,
    state: { answered: {} },
    view: { pos: K.V(0, 1.6, 14.5), look: K.V(0, -2.0, 0) },
    build: (ctx) => MOS.chapters.channel.build(ctx),
    renderOverlay(ctx, el) {
      const S = ctx.S.quiz;
      const score = () => Object.values(S.answered).filter(Boolean).length;
      el.innerHTML = `<div class="quiz-inner"><p class="score" id="score"></p>` + QUIZ.map((x, i) => `
        <div class="q card"><span class="part-tag">${x.part}</span><h3>Q${i + 1}. ${K.sub(x.q)}</h3>
        <div class="opts">${x.a.map((t, j) => `<button type="button" data-q="${i}" data-a="${j}">${K.sub(t)}</button>`).join("")}</div>
        <p class="fb" id="fb${i}"></p></div>`).join("")
        + `<p class="note">二乗則などの簡易モデルです。実物にはチャネル長変調や温度の影響などがあり、飽和領域でも電流はわずかに増えます。</p></div>`;
      const sc = el.querySelector("#score");
      sc.textContent = `${score()} / ${QUIZ.length} 問正解`;
      el.onclick = (e) => {
        const b = e.target.closest("button[data-q]"); if (!b) return;
        const i = +b.dataset.q, j = +b.dataset.a, x = QUIZ[i];
        b.parentElement.querySelectorAll("button").forEach((o) => o.classList.remove("right", "wrong"));
        b.classList.add(j === x.ok ? "right" : "wrong");
        el.querySelector("#fb" + i).innerHTML = j === x.ok ? K.sub("正解。" + x.why) : `もう一度。わからなければ「${x.part}」の章に戻ってみよう。`;
        S.answered[i] = j === x.ok;
        sc.textContent = `${score()} / ${QUIZ.length} 問正解`;
        if (score() === QUIZ.length) { ctx.done.quiz = true; ctx.refresh(); }
      };
    },
    update() { return { goal: "" }; },
    frame(ctx, dt) { MOS.chapters.channel.frame(ctx, dt, ctx.S.channel); },
  };
  MOS.PART_CH = PART_CH;
})();
