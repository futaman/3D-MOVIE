"""浜名湖まわりの構造物アセットを Blender (bpy) で作り、GLB と <name>.glb.js を書く。乱数なし。

    python3.13 -m venv .venv && .venv/bin/pip install bpy numpy      # bpy 5.x
    .venv/bin/python build_props.py                                  # 出力はこのフォルダ

作るもの(1 = 1 m、足元が原点、glTF の +Y が上、正面 +Z):
  torii        弁天島の赤鳥居(弁天島観光シンボルタワー)。高さ 18 m の明神鳥居の形。寸法は高さ以外は一般的な比率からの推定
  ferris_wheel 一般的な観覧車(直径 44 m、ゴンドラ 32 台)。特定の遊園地の物ではない。ロゴ・キャラクターなし
  coaster      一般的なジェットコースター(鋼製、周回 約 400 m、4 両の列車)。同上

柱と梁の構造物なので、既製素材ではなく形をスクリプトで組んでいる(人物・生き物・彫刻は作らない方針)。
"""
import os, json, math, base64
import numpy as np
import bpy, bmesh
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]

MATS = {}
def mat(name, hexc, rough, metal=0.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = srgb(hexc); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
            try: setattr(m, attr, val)
            except Exception: pass
    MATS[name] = m; return m

def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None: obj.parent = parent
    return obj

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None); e.location = loc; return link(e, parent)

def finish(obj, m, bevel=0.0, smooth=True, parent=None):
    obj.data.materials.append(m)
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    if bevel > 0:
        b = obj.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 2; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(40); b.harden_normals = False
    if smooth:
        try:
            obj.data.set_sharp_from_angle(angle=math.radians(40))
        except Exception:
            pass
    return obj

def mesh_from(name, verts, faces, m, bevel=0.0, smooth=True, parent=None, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    o = bpy.data.objects.new(name, me); o.location = loc; link(o, parent)
    return finish(o, m, bevel, smooth)

def box(name, size, loc, m, bevel=0.03, parent=None, rot=None):
    sx, sy, sz = [s / 2 for s in size]
    v = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz), (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    o = mesh_from(name, v, f, m, bevel, smooth=False, parent=parent, loc=loc)
    if rot: o.rotation_euler = rot
    return o

def tube(name, a, b, r1, m, r2=None, segs=24, parent=None, cap=True, bevel=0.0):
    """a から b への円柱(円錐台)。"""
    r2 = r1 if r2 is None else r2
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    verts, faces = [], []
    for k, (z, r) in enumerate(((0, r1), (L, r2))):
        for i in range(segs):
            t = 2 * math.pi * i / segs; verts.append(q @ Vector((r * math.cos(t), r * math.sin(t), z)) + a)
    for i in range(segs):
        j = (i + 1) % segs; faces.append((i, j, segs + j, segs + i))
    if cap: faces.append(tuple(reversed(range(segs)))); faces.append(tuple(range(segs, 2 * segs)))
    o = mesh_from(name, verts, faces, m, bevel, True, parent)
    if cap:
        for p in o.data.polygons[-2:]: p.use_smooth = False
    return o

def sweep(name, path, section, m, closed=False, parent=None, bevel=0.0, up=(0, 0, 1)):
    """path(点の列)に沿って断面(局所の (横, 上) の多角形)を流す。断面は進行方向に直角。"""
    P = [Vector(p) for p in path]; n = len(P); verts, faces = [], []; U = Vector(up)
    for i in range(n):
        if closed: t = (P[(i + 1) % n] - P[i - 1]).normalized()
        else: t = (P[min(i + 1, n - 1)] - P[max(i - 1, 0)]).normalized()
        side = t.cross(U).normalized(); upv = side.cross(t).normalized()
        for (sx, sy) in section: verts.append(P[i] + side * sx + upv * sy)
    k = len(section); rng = n if closed else n - 1
    for i in range(rng):
        a, b = i * k, ((i + 1) % n) * k
        for j in range(k):
            jj = (j + 1) % k; faces.append((a + j, a + jj, b + jj, b + j))
    if not closed: faces.append(tuple(reversed(range(k)))); faces.append(tuple(range((n - 1) * k, n * k)))
    return mesh_from(name, verts, faces, m, bevel, True, parent)

def bake_and_join(parent):
    """parent の直下のメッシュを、修飾子を適用してから材質ごとに 1 つにまとめる(描画の呼び出し回数を減らす)。"""
    dg = bpy.context.evaluated_depsgraph_get(); groups = {}
    for o in [c for c in parent.children if c.type == 'MESH']:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); o.modifiers.clear(); o.data = me
        groups.setdefault(o.data.materials[0].name if o.data.materials else '', []).append(o)
    for objs in groups.values():
        if len(objs) < 2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    for c in parent.children:
        if c.type == 'EMPTY': bake_and_join(c)

def export(path, root):
    bake_and_join(root)
    bpy.ops.object.select_all(action='DESELECT')
    objs = [root] + list(root.children_recursive)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_animations=False, export_extras=True, export_texcoords=False, export_tangents=False,
                              export_cameras=False, export_lights=False)

def write_js(name, meta):
    glb = os.path.join(HERE, name + '.glb')
    b64 = base64.b64encode(open(glb, 'rb').read()).decode()
    open(glb + '.js', 'w').write('(window.AUTO_ASSET_DATA=window.AUTO_ASSET_DATA||{})["%s.glb"]="%s";\nwindow.AUTO_ASSET_DATA["%s.meta"]=%s;\n' % (name, b64, name, json.dumps(meta, ensure_ascii=False)))
    json.dump(meta, open(os.path.join(HERE, name + '.meta.json'), 'w'), ensure_ascii=False, indent=1)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear()

# Blender の座標: x = 横、-y = 正面(glTF の +Z)、z = 上(glTF の +Y)

# ---------------------------------------------------------------- 赤鳥居
def build_torii():
    reset(); root = empty('torii')
    RED, BLK, CON = mat('vermilion', '#c8361c', 0.52), mat('black', '#1a1a1c', 0.6), mat('concrete', '#a3a19b', 0.92)
    H_TOP, SP, TILT = 18.0, 6.3, 0.3            # 全高、柱の中心(根元)の x、柱の上での内側への寄り
    PT = 14.6                                     # 柱の上端(島木の下)
    for s in (-1, 1):
        x0, x1 = s * SP, s * (SP - TILT)
        tube('pillar_%d' % (s > 0), (x0, 0, 0), (x1, 0, PT), 0.75, RED, r2=0.66, segs=40, parent=root)
        tube('kamagi_%d' % (s > 0), (x0, 0, -0.9), (x0 - s * 0.02, 0, 1.25), 0.95, BLK, r2=0.93, segs=40, parent=root, bevel=0.04)  # 根巻き
        tube('daiwa_%d' % (s > 0), (x1 + s * 0.012, 0, PT - 0.42), (x1, 0, PT), 0.8, RED, segs=40, parent=root, bevel=0.03)          # 台輪
        box('footing_%d' % (s > 0), (3.0, 3.0, 1.6), (x0, 0, -1.3), CON, bevel=0.06, parent=root)
        box('kusabi_%d' % (s > 0), (0.45, 0.62, 0.9), (s * (SP - TILT * 12.0 / PT) + s * 0.95, 0, 12.0), RED, bevel=0.02, parent=root)  # 楔
    # 貫(柱を貫く横木)
    box('nuki', (16.2, 0.62, 0.85), (0, 0, 12.0), RED, bevel=0.03, parent=root)
    # 額束
    box('gakuzuka', (0.9, 0.6, PT - 12.42), (0, 0, (PT + 12.42) / 2), RED, bevel=0.02, parent=root)
    # 島木(まっすぐ)
    box('shimaki', (16.4, 1.15, 0.9), (0, 0, PT + 0.45), RED, bevel=0.03, parent=root)
    # 笠木(両端が反り上がる。下は朱、上の笠は黒)
    HL, LIFT = 10.4, 0.85
    xs = np.linspace(-HL, HL, 81)
    zc = lambda x: PT + 0.9 + LIFT * (abs(x) / HL) ** 2.6
    path = [(x, 0, zc(x)) for x in xs]
    sweep('kasagi_lower', path, [(-0.62, 0), (0.62, 0), (0.66, 0.75), (-0.66, 0.75)], RED, parent=root, bevel=0.02)
    sweep('kasagi_top', [(x, 0, z + 0.75) for x, _, z in path], [(-0.8, 0), (0.8, 0), (0.72, 0.42), (0, 0.5), (-0.72, 0.42)], BLK, parent=root, bevel=0.02)
    top = zc(HL) + 1.25
    export(os.path.join(HERE, 'torii.glb'), root)
    write_js('torii', {
        "name": "弁天島の赤鳥居(弁天島観光シンボルタワー)", "height_m": round(top, 2), "origin": "地面(足元の基礎の上面)",
        "facts": {"height": "18 m", "built": "1973 年(昭和 48 年)、舞阪町観光協会", "note": "国有地のため宗教施設ではなく、鳥居の形をした観光シンボルタワー"},
        "fact_source": "国土交通省 観光庁 多言語解説文データベース「弁天島と乙女園」 https://www.mlit.go.jp/tagengo-db/en/R1-02366.html ほか",
        "estimated": "柱の太さ・柱間・貫や笠木の寸法は、明神鳥居の一般的な比率からの推定(実測ではない)",
    })

# ---------------------------------------------------------------- 観覧車
def build_ferris():
    reset(); root = empty('ferris_wheel')
    WHT, STL, HUB = mat('white_paint', '#eef0f2', 0.38, 0.1), mat('steel', '#b9bec4', 0.35, 0.6), mat('hub', '#5d6268', 0.4, 0.7)
    GLASS = mat('glass', '#1c2a33', 0.06, 0.0, alpha=0.45)
    PAL = ['#e8443a', '#f39a2b', '#f2cf2f', '#6cc04a', '#2fa7d8', '#3d6fd6', '#9a5bd1', '#e55a9b']
    HUBZ, R, RI, W, N = 27.0, 22.0, 18.6, 1.7, 32
    frame = empty('frame', parent=root)
    # 台座と乗り場
    box('station', (18, 9, 1.2), (0, 0, 0.6), mat('deck', '#8d9296', 0.85), bevel=0.05, parent=frame)
    box('station_roof', (12, 6, 0.35), (0, -1.5, 5.2), WHT, bevel=0.05, parent=frame)
    for x in (-5.6, 5.6):
        for y in (-4.2, 1.2): tube('roof_post', (x, y, 1.2), (x, y, 5.0), 0.12, WHT, parent=frame)
    # A 字の脚(前後 2 組)
    for s in (-1, 1):
        y_hub = s * (W + 1.0)
        for xb in (-15.5, 15.5):
            tube('leg', (xb, s * 7.5, 0.6), (0, y_hub, HUBZ), 0.62, WHT, r2=0.45, segs=28, parent=frame)
        tube('leg_tie', (-9.5, s * 5.1, 10.0), (9.5, s * 5.1, 10.0), 0.25, WHT, parent=frame)
        for xb in (-15.5, 15.5): box('leg_foot', (2.4, 2.4, 1.0), (xb, s * 7.5, 0.5), mat('concrete', '#a3a19b', 0.92), bevel=0.05, parent=frame)
    tube('axle', (0, -(W + 1.6), HUBZ), (0, W + 1.6, HUBZ), 0.7, HUB, segs=32, parent=frame)
    # 回る部分(原点がハブ)
    wheel = empty('wheel', loc=(0, 0, HUBZ), parent=root)
    for s in (-1, 1):
        y = s * W
        ring = lambda r: [(r * math.cos(2 * math.pi * i / 192), y, r * math.sin(2 * math.pi * i / 192)) for i in range(192)]
        sweep('rim_out', ring(R), [(0.32 * math.cos(a), 0.32 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 12, endpoint=False)], WHT, closed=True, parent=wheel, up=(0, 1, 0))
        sweep('rim_in', ring(RI), [(0.2 * math.cos(a), 0.2 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 10, endpoint=False)], WHT, closed=True, parent=wheel, up=(0, 1, 0))
        tube('hub_plate', (0, y - 0.15, 0), (0, y + 0.15, 0), 2.0, HUB, segs=40, parent=wheel)
        for i in range(N):  # 接線方向に張ったスポーク(実物の観覧車の張り方)
            a = 2 * math.pi * i / N
            for da in (0.32, -0.32):
                h = (1.8 * math.cos(a + da), y, 1.8 * math.sin(a + da))
                tube('spoke', h, (R * math.cos(a), y, R * math.sin(a)), 0.07, STL, segs=8, parent=wheel, cap=False)
            tube('strut', (RI * math.cos(a), y, RI * math.sin(a)), (R * math.cos(a + math.pi / N), y, R * math.sin(a + math.pi / N)), 0.12, WHT, segs=10, parent=wheel, cap=False)
    for i in range(N):
        a = 2 * math.pi * i / N
        tube('cross', (R * math.cos(a), -W, R * math.sin(a)), (R * math.cos(a), W, R * math.sin(a)), 0.16, WHT, segs=10, parent=wheel)
    # ゴンドラ(別ノード。原点は吊り点。回しても向きを保つよう JS で位置を毎コマ置く)
    PR = R + 0.25
    for i in range(N):
        a = 2 * math.pi * i / N
        g = empty('gondola_%02d' % i, loc=(PR * math.cos(a), 0, HUBZ + PR * math.sin(a)), parent=root)
        col = mat('gondola_%d' % (i % len(PAL)), PAL[i % len(PAL)], 0.35, 0.1)
        tube('hanger', (0, -0.6, 0), (0, 0.6, 0), 0.12, STL, segs=12, parent=g)
        tube('arm', (0, 0, 0), (0, 0, -0.9), 0.09, STL, segs=10, parent=g)
        box('body_low', (2.3, 2.1, 1.25), (0, 0, -3.1), col, bevel=0.35, parent=g)
        box('glass', (2.2, 2.0, 1.3), (0, 0, -1.95), GLASS, bevel=0.3, parent=g)
        box('roof', (2.35, 2.15, 0.4), (0, 0, -1.15), col, bevel=0.17, parent=g)
        box('seat', (0.5, 1.7, 0.45), (0.75, 0, -2.4), mat('seat', '#2b2f36', 0.8), bevel=0.05, parent=g)
        box('seat2', (0.5, 1.7, 0.45), (-0.75, 0, -2.4), mat('seat', '#2b2f36', 0.8), bevel=0.05, parent=g)
    export(os.path.join(HERE, 'ferris_wheel.glb'), root)
    write_js('ferris_wheel', {
        "name": "観覧車(一般的なもの)", "hub_height_m": HUBZ, "pivot_radius_m": PR, "gondolas": N, "diameter_m": 2 * R, "height_m": HUBZ + R + 0.4,
        "nodes": "frame(固定)、wheel(原点がハブ。glTF の z 軸まわりに回す)、gondola_00..31(原点が吊り点。位置は JS で置く)",
        "rotation": "1 周 15 分程度が普通。gondola_i の吊り点 = (r cos(a_i + θ), hub + r sin(a_i + θ), 0)、a_i = 2πi/32",
    })

# ---------------------------------------------------------------- ジェットコースター
def catmull(points, per):
    P = [np.array(p, float) for p in points]; n = len(P); out = []
    for i in range(n):
        p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % n], P[(i + 2) % n]
        for t in np.linspace(0, 1, per, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return out

def resample(pts, step):
    P = np.array(pts); seg = np.linalg.norm(np.roll(P, -1, 0) - P, axis=1); s = np.concatenate([[0], np.cumsum(seg)]); L = s[-1]
    Q = np.vstack([P, P[:1]]); out = []
    for d in np.arange(0, L, step):
        i = np.searchsorted(s, d, 'right') - 1; f = (d - s[i]) / seg[i]; out.append(Q[i] * (1 - f) + Q[i + 1] * f)
    return out, L

def build_coaster():
    reset(); root = empty('coaster')
    TRK, SUP, TIE = mat('track', '#1f8fb5', 0.35, 0.5), mat('support', '#f1f2f0', 0.45, 0.2), mat('tie', '#2e3338', 0.5, 0.5)
    CTRL = [(-30, -20, 2.2), (-10, -20, 2.2), (10, -20, 2.2), (24, -20, 5), (40, -20, 22), (52, -19, 30), (61, -12, 30.5), (62, -1, 29),
            (55, 8, 22), (42, 12, 5), (28, 13, 4), (14, 14, 15), (0, 15, 16), (-12, 14, 5), (-28, 12, 9), (-42, 4, 11), (-49, -8, 7), (-43, -18, 3)]
    raw = catmull(CTRL, 40); pts, L = resample(raw, 0.8); n = len(pts)
    G = 0.62  # レールの半分の間隔
    rails = {'L': [], 'R': [], 'S': []}
    for i, p in enumerate(pts):
        t = pts[(i + 1) % n] - pts[i - 1]; t /= np.linalg.norm(t); side = np.cross(t, [0, 0, 1]); side /= np.linalg.norm(side); up = np.cross(side, t)
        rails['L'].append(p + side * G); rails['R'].append(p - side * G); rails['S'].append(p - up * 0.55)
        if i % 2 == 0:
            tube('tie', p + side * (G + 0.05) - up * 0.06, p - side * (G + 0.05) - up * 0.06, 0.07, TIE, segs=6, parent=root, cap=False)
            tube('web', p - up * 0.08, p - up * 0.5, 0.06, TIE, segs=6, parent=root, cap=False)
    circ = lambda r, k: [(r * math.cos(a), r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, k, endpoint=False)]
    sweep('rail_l', rails['L'], circ(0.11, 10), TRK, closed=True, parent=root)
    sweep('rail_r', rails['R'], circ(0.11, 10), TRK, closed=True, parent=root)
    sweep('spine', rails['S'], circ(0.32, 14), TRK, closed=True, parent=root)
    # 支柱(高い所だけ。約 7 m ごと)
    for i in range(0, n, 9):
        s = rails['S'][i]
        if s[2] < 2.0: continue
        tube('column', (s[0], s[1], 0), (s[0], s[1], s[2] - 0.2), 0.3 if s[2] > 12 else 0.24, SUP, segs=16, parent=root)
        box('column_foot', (1.0, 1.0, 0.4), (s[0], s[1], 0.2), mat('concrete', '#a3a19b', 0.92), bevel=0.04, parent=root)
    # 乗り場
    box('platform', (26, 3.2, 1.6), (-10, -22.6, 0.8), mat('deck', '#8d9296', 0.85), bevel=0.04, parent=root)
    box('canopy', (28, 8, 0.35), (-10, -21, 6.4), mat('canopy', '#d94a3a', 0.5), bevel=0.06, parent=root)
    for x in (-23, -10, 3):
        for y in (-24.5, -17.5): tube('canopy_post', (x, y, 0), (x, y, 6.25), 0.15, SUP, parent=root)
    # 列車(4 両。原点は台車の中心でレール面の高さ、進行方向 +x。位置は JS で線路に沿って置く)
    CAR = [mat('car_a', '#e23b2e', 0.3, 0.2), mat('car_b', '#f2c12e', 0.3, 0.2)]
    for k in range(4):
        c = empty('car_%d' % k, loc=(-14 + k * 2.6, -20, 2.2), parent=root)
        box('car_body', (2.3, 1.6, 0.75), (0, 0, 0.62), CAR[k % 2], bevel=0.22, parent=c)
        box('car_seat', (0.9, 1.3, 0.5), (-0.25, 0, 1.1), mat('seat', '#2b2f36', 0.8), bevel=0.08, parent=c)
        box('car_bar', (0.15, 1.3, 0.15), (0.45, 0, 1.35), mat('steel', '#b9bec4', 0.35, 0.6), bevel=0.04, parent=c)
        for x in (-0.8, 0.8):
            for y in (-G, G): tube('wheel', (x, y - 0.12, 0.12), (x, y + 0.12, 0.12), 0.16, mat('tie', '#2e3338', 0.5, 0.5), segs=12, parent=c)
    export(os.path.join(HERE, 'coaster.glb'), root)
    track = [[round(float(p[0]), 2), round(float(p[2]), 2), round(float(-p[1]), 2)] for p in pts[::2]]   # glTF 座標 (x, 上, 南)
    write_js('coaster', {
        "name": "ジェットコースター(一般的なもの)", "length_m": round(float(L), 1), "max_height_m": round(float(max(p[2] for p in pts)), 1), "cars": 4, "car_spacing_m": 2.6,
        "nodes": "車両 car_0..3(原点はレール面、正面 +x)。track は線路の中心線(glTF 座標、1.6 m 間隔、閉じた輪)",
        "track": track,
    })

if __name__ == '__main__':
    build_torii(); build_ferris(); build_coaster()
    for f in ('torii', 'ferris_wheel', 'coaster'):
        print(f, os.path.getsize(os.path.join(HERE, f + '.glb')) // 1024, 'KB')
