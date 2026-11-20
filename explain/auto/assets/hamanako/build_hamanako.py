"""浜名湖の地形アセットを、公開されている衛星データから作る。

    pip install rasterio numpy pillow pyproj scipy
    CURL_CA_BUNDLE=<CA の束> python build_hamanako.py      # 出力はこのフォルダ

入力(どれも HTTP の範囲読み込みで必要な所だけ取る):
  - 色   : Copernicus Sentinel-2 L2A の TCI(10 m、2025-06-05、雲量 0.03 %)  AWS Open Data「sentinel-cogs」
  - 高さ : Copernicus DEM GLO-30(30 m)                                     AWS Open Data「copernicus-dem-30m」
  - 水域 : ESA WorldCover 2021 v200(10 m、分類 80 = 水域)                   AWS Open Data「esa-worldcover」
出力(格子は UTM 53N。原点は湖の中の (34.75, 137.58)、x = 東、z = 南、単位 m):
  hamanako_color.jpg  色(4096²、色と明るさを少し補正)
  hamanako_height.png 高さ(値 = R × 256 + G、標高 m = 値 / 50 - 100)
  hamanako_water.png  水域(8 bit、255 = 水)
  hamanako.meta.json  範囲・解像度・出典(hamanako.meta.js は同じ中身を <script> 用に包んだもの)
"""
import json, os, numpy as np, rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin
from pyproj import Transformer
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CENTER = (34.75, 137.58)          # 台本の landing と同じ
HALF = 24000                      # 中心から ±24 km
CRS = "EPSG:32653"
S2B = "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/53/S/QU/"
# 1 枚目が主。西の端は軌道の外で欠けるので、別の軌道の 2 枚目で埋める(色は重なりで 1 枚目に合わせる)
S2 = [S2B + "2025/6/S2C_53SQU_20250605_0_L2A/TCI.tif", S2B + "2024/5/S2A_53SQU_20240504_0_L2A/TCI.tif"]
DEM = "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N34_00_E137_00_DEM/Copernicus_DSM_COG_10_N34_00_E137_00_DEM.tif"
WC = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N33E135_Map.tif"

cx, cy = Transformer.from_crs("EPSG:4326", CRS, always_xy=True).transform(CENTER[1], CENTER[0])

def grid(n):
    return from_origin(cx - HALF, cy + HALF, 2 * HALF / n, 2 * HALF / n), (n, n)

def warp(url, n, bands, resampling, dtype):
    tr, shape = grid(n)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MULTIRANGE="YES"):
        with rasterio.open("/vsicurl/" + url) as src:
            out = np.zeros((len(bands),) + shape, dtype)
            for i, b in enumerate(bands):
                reproject(rasterio.band(src, b), out[i], dst_transform=tr, dst_crs=CRS, resampling=resampling)
    return out

def main():
    # 色: TCI は 8 bit。かすみを少し取り、彩度とコントラストを上げる
    from scipy.ndimage import distance_transform_edt
    wc = warp(WC, 4096, [1], Resampling.mode, np.uint8)[0]; wet = wc == 80
    rgb = warp(S2[0], 4096, [1, 2, 3], Resampling.lanczos, np.uint8).astype(np.float32) / 255
    for url in S2[1:]:
        hole = rgb.max(0) == 0
        if not hole.any(): break
        add = warp(url, 4096, [1, 2, 3], Resampling.lanczos, np.uint8).astype(np.float32) / 255
        both = ~hole & (add.max(0) > 0)
        for cls in (wet, ~wet):            # 水と陸で別々に色を合わせる
            ov, sel = both & cls, cls
            for b in range(3):
                a, m = add[b][ov], rgb[b][ov]
                add[b][sel] = (add[b][sel] - a.mean()) / (a.std() + 1e-6) * m.std() + m.mean()
        add = np.clip(add, 0, 1)
        w = np.clip(distance_transform_edt(~hole) / 250, 0, 1)   # 継ぎ目を 250 px かけて混ぜる
        sel = (w < 1) & (add.max(0) > 0)
        rgb[:, sel] = rgb[:, sel] * w[sel] + add[:, sel] * (1 - w[sel])
    lo, hi = np.percentile(rgb, 0.5), np.percentile(rgb, 99.7)
    rgb = np.clip((rgb - lo) / (hi - lo), 0, 1) ** 0.9
    lum = rgb.mean(0, keepdims=True); rgb = np.clip(lum + (rgb - lum) * 1.25, 0, 1)
    Image.fromarray((rgb.transpose(1, 2, 0) * 255 + 0.5).astype(np.uint8)).save(os.path.join(HERE, "hamanako_color.jpg"), quality=88, optimize=True)
    # 高さ
    h = warp(DEM, 1024, [1], Resampling.bilinear, np.float32)[0]
    v = np.clip((h + 100) * 50, 0, 65535).astype(np.uint32)   # ブラウザの canvas で 16 bit を失わないよう R(上位)と G(下位)に分ける
    Image.fromarray(np.stack([v >> 8, v & 255, np.zeros_like(v)], -1).astype(np.uint8), "RGB").save(os.path.join(HERE, "hamanako_height.png"))
    # 水域
    Image.fromarray(np.where(wet, 255, 0).astype(np.uint8)).resize((2048, 2048), Image.BILINEAR).save(os.path.join(HERE, "hamanako_water.png"))
    meta = {
        "center_latlon": CENTER, "crs": CRS, "size_m": 2 * HALF, "axes": "x = 東、z = 南(画像の上が北)、単位 m",
        "height_encoding": "値 = R * 256 + G、標高 m = 値 / 50 - 100", "height_range_m": [float(h.min()), float(h.max())],
        "sources": {
            "color": {"data": "Copernicus Sentinel-2 L2A TCI, 2025-06-05 (S2C_53SQU_20250605_0_L2A)。西端の欠けは 2024-05-04 (S2A_53SQU_20240504_0_L2A) で補完", "url": S2, "license": "Copernicus Sentinel data の利用規約(無償・商用可・再配布可、出典表記が必要)", "credit": "Contains modified Copernicus Sentinel data 2024-2025"},
            "height": {"data": "Copernicus DEM GLO-30", "url": DEM, "license": "Copernicus DEM GLO-30 のライセンス(無償・商用可・再配布可、出典表記が必要)", "credit": "Copernicus DEM © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA"},
            "water": {"data": "ESA WorldCover 10m 2021 v200", "url": WC, "license": "CC BY 4.0", "credit": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium"},
        },
    }
    json.dump(meta, open(os.path.join(HERE, "hamanako.meta.json"), "w"), ensure_ascii=False, indent=1)
    # file:// では JSON を fetch できないので、同じ中身を <script> で読める形でも置く
    open(os.path.join(HERE, "hamanako.meta.js"), "w").write('(window.AUTO_ASSET_DATA = window.AUTO_ASSET_DATA || {})["hamanako.meta"] = ' + json.dumps(meta, ensure_ascii=False) + ";\n")
    print("height", h.min(), h.max(), "water", wet.mean())

if __name__ == "__main__":
    main()
