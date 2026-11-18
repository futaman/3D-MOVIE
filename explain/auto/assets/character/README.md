# 計算係 (keisan) — 骨入りキャラクター

白衣・青緑のキャップ・丸めがね・紺のズボンのオリジナルキャラクター。約 3.7 頭身、身長 1.7、足元が原点、正面 +Z。
Blender (bpy 5.3、ヘッドレス) の Python で生成している。テクスチャなし、マテリアル 14 色、約 1.3 万頂点。

| ファイル | 内容 |
|---|---|
| `keisan.glb` | 本体 (メッシュ + 骨 + 7 クリップ) |
| `keisan.glb.js` | 同じ GLB を base64 にした JS + メタ情報。`file://` ではこちらを `<script>` で読む |
| `keisan.meta.json` | クリップの長さ、手を離す時刻など |
| `paper_plane.glb` / `.glb.js` | 紙飛行機 (機首 +Z、長さ 1、両面、フラットシェーディング) |
| `build_keisan.py` | 生成スクリプト (乱数なし。何度回しても同じ結果) |
| `preview/sheet_clips.png`, `preview/sheet_throw.png` | 確認用のコマ一覧 |

## 骨 (ノード名)

`hips` → `spine1` → `spine2` → `neck` → `head`
`spine2` → `shoulder_L/R` → `upper_arm_L/R` → `forearm_L/R` → `hand_L/R`、`hand_R` → `hand_R_attach`
`hips` → `thigh_L/R` → `shin_L/R` → `foot_L/R`

- L はキャラの左 (+X)、R は右 (−X)。
- すべての骨は静止時の回転が単位 (ローカル軸 = ワールド軸: +Y 上、+Z 正面)。手で回すときは X=前後に倒す、Y=ひねり、Z=左右に倒す。
- `hand_R_attach` は右の手のひら (親指と手のひらの間) の空ノード。静止時は軸がワールドと平行。物を持たせるときは子にするか、`matrixWorld` を写す。

## クリップ (30fps でサンプル済み)

| 名前 | 長さ | ループ | 内容 |
|---|---|---|---|
| `idle` | 2.0 | ○ | 呼吸と軽い重心移動 (足は接地したまま) |
| `hold` | 2.0 | ○ | 右手を胸の前に。軽い呼吸つき。`hold` t=0 = `throw` t=0 |
| `throw` | 1.2 | × | 0.2 構え → 0.43 振りかぶり (左足を上げる) → 0.6 踏み込み → **0.7333 手を離す** → 0.9 フォロースルー → 1.2 |
| `shake_head` | 1.2 | × | 腰に手を当てて首を横に振る。最後は腰に手のまま止まる |
| `look_up` | 1.0 | × | 少し沈んでから見上げて止まる (0.8 以降は静止) |
| `wave` | 1.6 | ○ | 右手を上げて振る (1 周期に 2 往復) |
| `walk` | 1.0 | ○ | その場歩き (1 秒で 2 歩) |

手を離す時刻: **0.7333 秒 (22 フレーム目)**。`keisan.meta.json` の `throw_release_time`、GLB のルートノード `keisan` の `userData.throw_release_time`、
`assets.js` の `ch.releaseTime` で取れる。その瞬間の `hand_R_attach` の位置 (root ローカル) は `throw_release_hand_pos` = [-0.03, 1.19, 0.81]。投げる向きは +Z。

## 読み込み

```html
<script src="vendor/three.min.js"></script>
<script src="assets.js"></script>   <!-- vendor/GLTFLoader.js は無ければ自動で読む -->
<script>
(async () => {
  const ch = await AutoAssets.loadCharacter();        // Promise。window.__READY はこれを待ってから立てる
  scene.add(ch.root);                                  // root は自由に position / rotation / scale してよい
  ch.play("throw", 0.5);                               // 指定時刻の姿勢。ループの有無はクリップ既定、{loop:true/false} で上書き
  ch.blend("throw", 1.2, "idle", t, w);                // A を w=0、B を w=1 として合成
  const plane = await AutoAssets.loadModel("paper_plane");
  ch.handR.getWorldPosition(plane.position);           // play / blend の直後は行列が更新済み
})();
</script>
```

- `play` / `blend` は毎回静止姿勢に戻してから補間値を書き込む。AnimationMixer も壁時計も使わないので、同じ引数なら必ず同じ姿勢になる (確認済み)。
- `file://` では fetch / XHR が使えないため、`keisan.glb.js` (base64) を `<script>` で読み込む。Chromium の追加フラグは不要。
  http(s) で配るときは `.glb.js` が無ければ `.glb` を fetch する。
- ほかに `ch.clips` (長さとループ)、`ch.bones` (名前 → ノード)、`ch.head`、`ch.releaseTime`、`ch.reset()`。
- 影: 全メッシュ `castShadow = true`。SkinnedMesh は `frustumCulled = false` にしてある。
- GLB を作り直したら `.glb.js` も同時に出力される (片方だけ差し替えないこと)。

## 作り直し

```sh
python3 -m venv .venv && .venv/bin/pip install bpy numpy   # Python 3.13 / bpy 5.3 で確認
.venv/bin/python build_keisan.py                           # このディレクトリに上書き出力
```

スクリプト内の節: 「寸法」(関節位置)、「色」、「メッシュ」(回転体・楕円体・チューブの組み合わせ。ウェイトは位置から計算)、
「クリップ」(手首と足の接地点を指定 → 2 骨 IK で解いて 30fps で焼き込み)。座標は Blender 系 (x=左, −y=正面, z=上)。

## 既知の弱点

- 表情の骨・モーフがない。まゆ・口は固定なので `shake_head` の「不満げ」は体の動き (腰に手 + 首振り) だけ。
- 指がない (ミトン型の手 + 親指)。紙飛行機は「握る」のではなく手のひらに添える見え方になる。
- 肩はそでの球を胴に差し込む作りで、後ろ・斜めから見ると継ぎ目の段が見える。腕を真上に上げると肩が少し不自然。
- 白衣のすそは腿に 7 割ついていくだけ。布の揺れはない。大きく足を上げると前すそが持ち上がる。
- `throw` は左足を踏み出した姿勢で終わる (元の立ち位置に戻らない)。`idle` へは `blend` でつなぐこと。その間、足は少し滑る。
- `shake_head` / `look_up` も終わりの姿勢が `idle` と違う。つなぐときは `blend`。
- 2 クリップの `blend` は骨ごとの単純な補間。離れた姿勢どうし (例: idle と wave の 0.5) は中間が不自然になる。短い切り替え用。
- 髪とキャップの境目が少しギザつく。白衣は強い光で白飛びしやすい (色は #e6e9ee。確認は Hemisphere 0.75 + Directional 0.85)。
- 影つきで描くと白衣に小さな暗い点が出ることがある (シャドウマップ由来と思われる。原因は未調査)。
- GLB は 1.05MB (base64 で 1.4MB)。Draco 圧縮なし。
