# 浜名湖の地形アセット(実データ)

衛星写真・標高・水域図から作った、浜名湖のまわり 48 km 四方の地形。`build_hamanako.py` で作り直せる。

```js
const tr = await AutoAssets.loadTerrain("hamanako", { coastZ: 9000 });   // lib/assets.js
scene.add(tr.root);            // 地形 + 湖面・海面 + 範囲外の平地
tr.heightAt(x, z);             // その地点の地面の高さ(m)。水の上は -5
```

- 1 = 1 m。原点は湖の中の 34.75N 137.58E(第 2 回の `landing`)、x = 東、z = 南。
- 地形のメッシュは 512 × 512(約 94 m 間隔)。水域は高さ -5 m に下げ、y = 0 に半透明の水面を張る。
- 範囲の端は 4 km かけて平らにし、外側の平地(北・東・西)と海(`coastZ` より南)につなぐ。
- 画像テクスチャを file:// で読むので、Chromium は `--allow-file-access-from-files` で起動する(`bin/render.cjs` は対応済み)。

| ファイル | 中身 | 出典 | ライセンス |
|---|---|---|---|
| `hamanako_color.jpg` | 色(4096²、約 12 m/px。かすみ取り・彩度補正) | Copernicus Sentinel-2 L2A TCI 2025-06-05(西端の欠けは 2024-05-04 で補完)。AWS Open Data `sentinel-cogs` | Copernicus Sentinel data の条件(無償・商用可・再配布可)。表記「Contains modified Copernicus Sentinel data 2024-2025」 |
| `hamanako_height.png` | 高さ(1024²、値 = R×256+G、標高 m = 値/50 − 100) | Copernicus DEM GLO-30。AWS Open Data `copernicus-dem-30m` | Copernicus DEM GLO-30 の条件(無償・商用可・再配布可)。表記は `hamanako.meta.json` |
| `hamanako_water.png` | 水域(2048²、255 = 水) | ESA WorldCover 10m 2021 v200(分類 80)。AWS Open Data `esa-worldcover` | CC BY 4.0。表記「© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium」 |

出典の表記は動画の説明文に入れる(`episode.json` の `meta.credits`。`bin/meta.mjs` が説明文の【映像素材】に書く)。
