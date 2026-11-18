# human01 — 既製素材を組み合わせた人物 (MakeHuman + CMU モーションキャプチャ)

成人男性、白 T シャツ・ジーンズ・スニーカー、黒の短髪。身長 1.7、足元が原点、正面 +Z。
体・顔・肌・髪・服・靴・骨・ウェイトはすべて MakeHuman の既製素材 (CC0)。造形は書いていない。
自作は青緑のキャップと丸めがね (別ノード `cap` / `glasses`) だけ。白衣は既製品が無いので付けていない。

| ファイル | 内容 |
|---|---|
| `human01.glb` | 本体 6.0 MB (メッシュ 11 個 + 骨 54 本 + 7 クリップ + テクスチャ 10 枚) |
| `human01.glb.js` | 同じ GLB の base64 + メタ情報 (8.1 MB)。`file://` ではこちらを読む |
| `human01.meta.json` | クリップの長さ、手を離す時刻、モーションの出どころ |
| `build_human01.py` | 生成スクリプト (乱数なし) |
| `preview/` | 確認シート、前回との比較 `compare.png`、撮影用の `tools/` |

## 素材と出典・ライセンス

| 素材 | 名前 | 出典 | ライセンス |
|---|---|---|---|
| 体のメッシュ・体型ターゲット・表情ターゲット・骨 (`game_engine` リグ) とウェイト | MPFB 2.0.18 同梱データ (MakeHuman base mesh hm08) | https://extensions.blender.org/add-ons/mpfb/ | データは CC0 (アドオンのコードは GPL-3.0。コードは同梱していない。MPFB で作った出力は CC0 として使える) |
| 肌 | `skins/young_asian_male` (2048 に縮小せず JPEG 化) | MakeHuman system assets: https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip | CC0 |
| 服 | `clothes/male_casualsuit06` (ベースカラー 2048 + 法線 1024) | 同上 | CC0 |
| 靴 | `clothes/shoes05` | 同上 | CC0 |
| 髪 | `hair/short04` | 同上 | CC0 |
| 目・まゆ・まつ毛・歯・舌 | `eyes/high-poly` + `brown`、`eyebrow001`、`eyelashes01`、`teeth_base`、`tongue01` | 同上 | CC0 |
| モーション | CMU Graphics Lab Motion Capture Database の `124_01` (投球)、`141_16` (手を振る)、`07_01` (歩行)。B. Hahne の BVH 変換 (2010) | 元: http://mocap.cs.cmu.edu/ 。BVH: https://github.com/una-dinosauria/cmu-mocap (`data/124/124_01.bvh` など) | 制限なし (研究・商用とも自由。BVH 変換にも追加の制限なし)。謝辞の文: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." |
| キャップ・めがね | 自作 (スクリプト内) | — | — |

素材の全ファイルの先頭に「2020 年 9 月に CC0 で公開」と明記されている。NC・再配布不可の素材、ログインが必要な配布元は使っていない。

素材に加えた変更: T シャツのテクスチャにあった MakeHuman のロゴ 3 か所を周囲の色で塗りつぶした。虹彩の色を赤茶からこげ茶に寄せた。
口角を上げるターゲットと目を少し大きくするターゲットを掛けた。服を法線方向に 3 mm ふくらませた (肌の突き抜け対策)。

## ノードと骨

メッシュ: `body` `clothes` `shoes` `hair` `eyes` `eyebrows` `eyelashes` `teeth` `tongue` `cap` `glasses`。
`cap` と `glasses` は `ch.bones.cap.visible = false` で消せる (既定は表示)。

骨 (MakeHuman の game_engine リグ、L は `_l`、R は `_r`):
`Root` → `pelvis` → `spine_01` → `spine_02` → `spine_03` → `neck_01` → `head`
`spine_03` → `clavicle_l/r` → `upperarm` → `lowerarm` → `hand` → `thumb/index/middle/ring/pinky_01..03`
`pelvis` → `thigh_l/r` → `calf` → `foot` → `ball`
`hand_r` → `hand_R_attach` (右手の親指と人差し指の先の間。`hold` t=0 の姿勢で軸がワールドと平行 = 紙飛行機の機首が +Z を向く)

静止姿勢は A ポーズで、骨の静止時の回転は単位ではない (keisan とは違う)。骨を手で回すときは注意。
`ch.head` は `head`、`ch.handR` は `hand_R_attach`。

## クリップ (30fps)

| 名前 | 長さ | ループ | 作り方 |
|---|---|---|---|
| `idle` | 2.0 | ○ | キー打ち (立ち姿 + 呼吸と小さな重心移動、足は IK で固定) |
| `hold` | 2.0 | ○ | キー打ち (右腕 IK、指でつまむ形)。`hold` t=0 = `throw` t=0 |
| `throw` | 1.3333 | × | **モーションキャプチャ** (CMU 124_01 の 2.65〜4.00 秒)。最初の 0.3 秒で hold からつなぐ。足を上げる → 踏み込み → 振り抜き |
| `shake_head` | 1.2 | × | キー打ち (首・頭・胸を左右に) |
| `look_up` | 1.0 | × | キー打ち (0.7 秒で見上げて止まる) |
| `wave` | 0.8 | ○ | **モーションキャプチャ** (CMU 141_16 の上半身) を立ち姿の下半身に重ねた。右手を顔の横で小さく 4 往復 |
| `walk` | 1.1 | ○ | **モーションキャプチャ** (CMU 07_01 の 1 周期)。進んだ分を引いたその場歩き |

手を離す時刻: **1.0667 秒 (32 コマ目、右手の速さが最大のコマ)**。`meta.throw_release_time` / `ch.releaseTime`。
その時の `hand_R_attach` の位置 (root ローカル) は `throw_release_hand_pos` = [-0.009, 1.396, 1.350]。投げる向きは +Z。
`throw` は野球の投球なので前に大きく踏み出す: 終わりの腰の位置は `throw_end_pelvis_pos` (z ≒ 0.67)。元の歩幅の 0.75 倍にしてある。

リターゲットの方法: BVH の T ポーズのコマを基準に各関節のワールド回転の差分を取り、こちらの骨を同じ T ポーズ相当に合わせた上で差分を掛ける。
腰と足首の位置は脚の長さの比で縮め、脚は 2 骨 IK で足首に合わせる。接地中は足裏を水平に寄せる。指は mocap に無いのでキー打ち。

## 読み込み

```js
const ch = await AutoAssets.loadCharacter("human01");   // assets.js の DIRS に human01 を足してある
ch.play("throw", 0.5); ch.bones.cap.visible = false;
```

`renderer.outputEncoding = THREE.sRGBEncoding` 前提。髪・まゆ・まつ毛は alphaMode BLEND、目は MASK、ほかは不透明。

## 作り直し

```sh
pip install bpy pillow numpy            # bpy 5.3
# MPFB 2.0.18 を入れる: bpy.ops.extensions.package_install_files(filepath="add-on-mpfb-v2.0.18.zip", repo="user_default", enable_on_install=True)
# makehuman_system_assets_cc0.zip を MPFB のユーザーデータ (~/.config/blender/5.3/extensions/.user/user_default/mpfb/data/) に展開
# 124_01.bvh, 141_16.bvh, 07_01.bvh を 1 つのディレクトリに置く
python build_human01.py --bvh <BVH のディレクトリ> --cache <作業用>
```

`--explore 124_01:2.6:4.2` で BVH の区間を `x0` というクリップにして素材選びができる。
確認シート: `NODE_PATH=$(npm root -g) node preview/tools/shot.cjs preview/tools/throw.json out.png` (`sheet.html` 内のパスは絶対パス)。

## 既知の弱点

- 表情の骨・モーフを入れていない。顔は固定 (軽い笑み、口が少し開いて歯が見える)。まばたき・視線の動きなし。目は正面固定でハイライトが弱い。
- `throw` は本物の投球なので、紙飛行機には大げさ。前に 0.7 m ほど進んで終わるので、`idle` に戻すときは `blend` + root の位置合わせが要る。最初の 0.3 秒は hold から横向きの構えへ急いでつなぐため足が滑る。足を高く上げるコマで T シャツのすそが尖る。
- `idle` / `hold` / `shake_head` / `look_up` は mocap ではなくキー打ち。動きは小さく硬い。立ち姿は少しがに股。
- T シャツは体に貼り付く作りで、布の揺れ・しわの変化はない。肩を大きく回すと袖口が伸びる。
- 髪は板ポリ + 透過テクスチャ。寄りでは生え際が板に見える。半透明なので、後ろに別の半透明物があると描画順が乱れることがある。
- 肌は 1 枚のベースカラーだけ (法線・SSS なし)。Three.js の標準マテリアルでは蝋っぽく見える。照明が強いと白飛びしやすい。
- 骨 1 頂点 4 本までに丸められている (書き出し時)。ひじ・ひざは線形スキニングなので深く曲げると細る。
- キャップは髪と頭を包む半径を測って作った単純なドーム。帽子を消すと額が広く見える髪型 (short04)。
