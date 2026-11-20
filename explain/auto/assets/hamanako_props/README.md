# 浜名湖まわりの構造物アセット

柱と梁でできた構造物を、`build_props.py`(Blender の bpy)で実寸どおりに組んだもの。人物・生き物・彫刻・建物の外観は作らない(コードで造形すると見劣りするため。skill のアセット方針)。実在の施設のロゴ・キャラクター・看板の文字は入れていない。

| 名前 | 中身 | 大きさ | ノード |
|---|---|---|---|
| `torii` | 弁天島の赤鳥居(弁天島観光シンボルタワー)。明神鳥居の形、朱と黒、根巻き・台輪・楔つき | 高さ 18 m | 1 つにまとまっている。原点は地面 |
| `ferris_wheel` | 一般的な観覧車。ゴンドラ 32 台(8 色)、接線張りのスポーク、A 字の脚、乗り場 | 直径 44 m、高さ 約 49 m | `frame`(固定)、`wheel`(原点がハブ、z 軸で回す)、`gondola_00`〜`31`(原点が吊り点) |
| `coaster` | 一般的な鋼製ジェットコースター。巻き上げ・落下・丘・カーブ、支柱、屋根つき乗り場 | 周回 約 400 m、最高 約 30 m | 線路は固定。`car_0`〜`3` は JS で `meta.track` に沿って置く |

```js
const torii = await AutoAssets.loadModel("torii");          // lib/assets.js
const fw = await AutoAssets.loadModel("ferris_wheel"), m = window.AUTO_ASSET_DATA["ferris_wheel.meta"];
// 回す: wheel.rotation.z = θ。ゴンドラは向きを変えずに吊り点だけ動かす
fw.getObjectByName("wheel").rotation.z = th;
for (let i = 0; i < m.gondolas; i++) { const a = 2 * Math.PI * i / m.gondolas + th; fw.getObjectByName("gondola_" + String(i).padStart(2, "0")).position.set(m.pivot_radius_m * Math.cos(a), m.hub_height_m + m.pivot_radius_m * Math.sin(a), 0); }
```

赤鳥居について(出典つき): 高さ 18 m、1973 年(昭和 48 年)に舞阪町観光協会が建設。国有地のため宗教施設ではなく「鳥居の形をした観光シンボルタワー」(国土交通省 観光庁 多言語解説文データベース https://www.mlit.go.jp/tagengo-db/en/R1-02366.html ほか)。高さ以外の寸法(柱の太さ・柱間・貫や笠木)は明神鳥居の一般的な比率からの推定で、実測ではない。

観覧車とジェットコースターは特定の遊園地の物を写したものではない。浜名湖パルパルの場面に使うときも、実物と同じ形だとは言わない(字幕・ラベルで「イメージ」とする)。

確認シート: `preview/sheet_all.png`(`node preview/shot.cjs preview/cells.json <出力>` で撮り直せる)。

まだ作っていないもの: 舘山寺(大観音)、オルゴールミュージアム。コードで造形すると見劣りするので、実データ(PLATEAU など)か、商用可・再配布可の写真・3D モデルが手に入ってから作る。
