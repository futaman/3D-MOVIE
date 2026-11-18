"""human01 — MakeHuman (MPFB2) の既製素材を組み合わせた人物を GLB にする。

  python build_human01.py [--bvh DIR] [--cache DIR] [--out DIR]

前提: bpy 5.3 + MPFB 2.0.18 が有効、MPFB のユーザーデータに makehuman_system_assets (CC0) を展開済み。
      Pillow、numpy。CMU の BVH (cgspeed 版) を --bvh のディレクトリに置く。詳しくは README.md。
造形は書かない (体・顔・髪・服・靴・骨・ウェイトはすべて MakeHuman)。自前で作るのはキャップとめがねだけ。
乱数なし。座標は Blender 系 (x=キャラの左, -y=正面, z=上) で作り、書き出しで glTF の +Y 上 / +Z 正面になる。
"""
import bpy, sys, os, json, math, struct, base64, argparse
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--bvh', default=os.path.join(HERE, 'bvh'))
ap.add_argument('--cache', default=os.path.join(HERE, '.cache'))
ap.add_argument('--out', default=HERE)
ap.add_argument('--explore', action='append', default=[], help='name:t0:t1[:yaw] を x0, x1.. というクリップにする (素材選び用)')
ap.add_argument('--static', action='store_true', help='アニメーションなしで書き出す (見た目の確認用)')
args = ap.parse_args(sys.argv[1:])
os.makedirs(args.cache, exist_ok=True)
NAME, HEIGHT, FPS = 'human01', 1.7, 30

# ───────────────────────── 素材の選択 ─────────────────────────
MACRO = dict(gender=1.0, age=0.5, muscle=0.55, weight=0.45, proportions=0.6, height=0.5, cupsize=0.5, firmness=0.5,
             race=dict(asian=0.8, caucasian=0.2, african=0.0))
SKIN = 'skins/young_asian_male/young_asian_male.mhmat'
PARTS = [  # (mhclo, 種別, glTF ノード名)
    ('eyes/high-poly/high-poly.mhclo', 'Eyes', 'eyes'),
    ('eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows', 'eyebrows'),
    ('eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes', 'eyelashes'),
    ('teeth/teeth_base/teeth_base.mhclo', 'Teeth', 'teeth'),
    ('tongue/tongue01/tongue01.mhclo', 'Tongue', 'tongue'),
    ('hair/short04/short04.mhclo', 'Hair', 'hair'),
    ('clothes/male_casualsuit06/male_casualsuit06.mhclo', 'Clothes', 'clothes'),
    ('clothes/shoes05/shoes05.mhclo', 'Clothes', 'shoes'),
]
EXPRESSION = [('mouth/mouth-angles-up.target.gz', 0.6), ('expression/units/asian/mouth-corner-puller.target.gz', 0.0)] + [
    ('eyes/%s-eye-%s.target.gz' % (s_, t_), w_) for s_ in 'lr' for t_, w_ in (('height2-incr', 0.6), ('scale-incr', 0.35))]
# テクスチャの縮小と形式。(最大辺, 形式)。名前は元ファイル名の先頭一致
TEX = [('young_lightskinned', 2048, 'JPEG'), ('male_casualsuit06_diffuse', 2048, 'JPEG'), ('male_casualsuit06_normal', 1024, 'JPEG'),
       ('shoes05', 1024, 'JPEG'), ('short04', 2048, 'PNG'), ('eyebrow', 512, 'PNG'), ('eyelashes', 512, 'PNG'),
       ('brown_eye', 512, 'PNG'), ('teeth', 512, 'JPEG'), ('tongue', 256, 'JPEG')]
# glTF マテリアルの後処理: (alphaMode, alphaCutoff, doubleSided, roughness)
MAT = {'body': ('OPAQUE', None, False, 0.62), 'clothes': ('OPAQUE', None, True, 0.9), 'shoes': ('OPAQUE', None, False, 0.75),
       'hair': ('BLEND', None, True, 0.7), 'eyebrows': ('BLEND', None, True, 0.9), 'eyelashes': ('BLEND', None, True, 0.9),
       'eyes': ('MASK', 0.5, False, 0.2), 'cap': ('OPAQUE', None, True, 0.85), 'glasses': ('OPAQUE', None, False, 0.35), 'teeth': ('OPAQUE', None, False, 0.4), 'tongue': ('OPAQUE', None, False, 0.5)}

# ───────────────────────── 1. MPFB で人体を組む ─────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')
from bl_ext.user_default.mpfb.services import HumanService, TargetService, LocationService, ObjectService
DATA = LocationService.get_user_data()
body = HumanService.create_human(scale=0.1, macro_detail_dict=MACRO, feet_on_ground=True)
for tpath, tw in EXPRESSION:                     # 口角を少し上げる (MakeHuman の表情ターゲット)
    TargetService.load_target(body, os.path.join(LocationService.get_mpfb_data('targets'), tpath), weight=tw)
HumanService.set_character_skin(os.path.join(DATA, SKIN), body, skin_type='GAMEENGINE', material_instances=False)
HumanService.add_builtin_rig(body, 'game_engine', import_weights=True)
rig = ObjectService.find_object_of_type_amongst_nearest_relatives(body, 'Skeleton')
meshes = {'body': body}
for path, kind, node in PARTS:
    meshes[node] = HumanService.add_mhclo_asset(os.path.join(DATA, path), body, asset_type=kind, subdiv_levels=0, material_type='GAMEENGINE')
rig.name = NAME; rig.data.name = NAME + '_rig'
for node, o in meshes.items():
    o.name = node; o.data.name = node; o.material_slots[0].material.name = node

# シェイプキーを焼き込み、マスク (服の下の肌を消す) を適用する
def sel(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
for o in meshes.values():
    if o.data.shape_keys:
        o.shape_key_add(name='_mix', from_mix=True)
        for k in list(o.data.shape_keys.key_blocks):
            if k.name != '_mix': o.shape_key_remove(k)
        o.shape_key_remove(o.data.shape_keys.key_blocks['_mix'])
    sel(o)
    for m in list(o.modifiers):
        if m.type == 'MASK': bpy.ops.object.modifier_apply(modifier=m.name)
        elif m.type != 'ARMATURE': o.modifiers.remove(m)

for v in meshes['clothes'].data.vertices: v.co += v.normal * 0.003     # 服を 3mm ふくらませて肌の突き抜けを減らす
# ───────────────────────── 2. テクスチャ ─────────────────────────
def prep_texture(src, size, fmt):
    dst = os.path.join(args.cache, os.path.splitext(os.path.basename(src))[0] + ('.jpg' if fmt == 'JPEG' else '.png'))
    im = Image.open(src)
    if 'male_casualsuit06_diffuse' in src:      # T シャツのロゴ (3 か所) を周囲の色で塗りつぶす
        im = im.convert('RGB'); a = np.asarray(im).copy()
        for x0, y0, x1, y1 in [(395, 235, 615, 345), (900, 240, 1290, 425), (1495, 315, 1545, 365)]:
            ring = np.concatenate([a[y0 - 6:y0, x0:x1].reshape(-1, 3), a[y1:y1 + 6, x0:x1].reshape(-1, 3)])
            a[y0:y1, x0:x1] = np.median(ring, axis=0)
        im = Image.fromarray(a)
    if 'brown_eye' in src:                      # 虹彩が赤く出るので、こげ茶に寄せる
        a = np.asarray(im.convert('RGBA')).astype(float); r, g = a[..., 0], a[..., 1]
        m = np.clip((r - g - 25) / 40, 0, 1)[..., None]; a[..., :3] = a[..., :3] * (1 - m) + a[..., :3] * np.array([0.42, 0.52, 0.62]) * m
        im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    im = im.convert('RGB' if fmt == 'JPEG' else 'RGBA')
    if max(im.size) > size: im = im.resize((size, size), Image.LANCZOS)
    im.save(dst, fmt, **({'quality': 88} if fmt == 'JPEG' else {'optimize': True}))
    return dst
for img in bpy.data.images:
    src = bpy.path.abspath(img.filepath)
    for key, size, fmt in TEX:
        if os.path.basename(src).startswith(key):
            img.filepath = prep_texture(src, size, fmt); img.reload(); break
    else:
        if img.size[0]: print('WARN: texture without rule', src)
for node, o in meshes.items():                 # 不透明な素材はアルファの接続を外す (JPEG で書き出される)
    if MAT[node][0] != 'OPAQUE': continue
    nt = o.material_slots[0].material.node_tree
    for l in list(nt.links):
        if l.to_socket.name == 'Alpha': nt.links.remove(l)

# ───────────────────────── 3. 大きさをそろえる (身長 1.7、足元が原点) ─────────────────────────
def world_z(o): return [(o.matrix_world @ v.co).z for v in o.data.vertices]
zmin = min(world_z(meshes['shoes'])); zmax = max(world_z(meshes['body']))
k = HEIGHT / (zmax - zmin)
rig.scale = (k, k, k); rig.location = (0, 0, -zmin * k)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in [rig] + list(meshes.values()): o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print('scale', round(k, 4), 'height', round(max(world_z(meshes['body'])), 4), 'min', round(min(world_z(meshes['shoes'])), 4))

# ───────────────────────── 3b. 小物 (自作はここだけ): キャップと丸めがね。別ノード、head の骨に付く ─────────────────────────
import bmesh
def flat_mat(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*[((c / 255 + 0.055) / 1.055) ** 2.4 for c in rgb], 1); return m
def prop(name, bm, mat, smooth_=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    for p_ in me.polygons: p_.use_smooth = smooth_
    me.materials.append(mat); o.parent = rig; vg = o.vertex_groups.new(name='head'); vg.add(range(len(me.vertices)), 1.0, 'REPLACE')
    md = o.modifiers.new('Armature', 'ARMATURE'); md.object = rig; meshes[name] = o; return o
def wco(o): return np.array([list(o.matrix_world @ v.co) for v in o.data.vertices])
def unit(v): v = np.asarray(v, float); return v / (np.linalg.norm(v) + 1e-12)
def tube(bm, pts, r, seg=8, closed=False):
    """点列に沿った細い管"""
    rings = []; n = len(pts)
    for i, p_ in enumerate(pts):
        a, b = pts[(i - 1) % n if closed else max(i - 1, 0)], pts[(i + 1) % n if closed else min(i + 1, n - 1)]
        t = unit(np.array(b) - np.array(a)); u = unit(np.cross(t, [0, 1, 0]) if abs(t[1]) < 0.95 else np.cross(t, [1, 0, 0])); w = np.cross(t, u)
        rings.append([bm.verts.new((np.array(p_) + r * (math.cos(2 * math.pi * k_ / seg) * u + math.sin(2 * math.pi * k_ / seg) * w)).tolist()) for k_ in range(seg)])
    for i in range(n if closed else n - 1):
        A_, B_ = rings[i], rings[(i + 1) % n]
        for k_ in range(seg): bm.faces.new([A_[k_], A_[(k_ + 1) % seg], B_[(k_ + 1) % seg], B_[k_]])
def make_cap():
    hv = np.concatenate([wco(meshes['hair']), wco(meshes['body'])]); top = hv[:, 2].max(); zc = top - 0.078
    up = hv[hv[:, 2] > zc - 0.03]; c0 = np.array([0.0, (up[:, 1].min() + up[:, 1].max()) / 2, zc]); rel = up - c0; dist = np.linalg.norm(rel, axis=1) + 1e-9
    NU, NV = 36, 10; rad = np.zeros((NV + 1, NU))
    for j in range(NV + 1):                       # 髪と頭を包む半径を方向ごとに測る (包むだけで、形は作らない)
        for i in range(NU):
            ph, az = (j / NV) * math.pi / 2, 2 * math.pi * i / NU; d = np.array([math.cos(ph) * math.cos(az), math.cos(ph) * math.sin(az), math.sin(ph)])
            pr = rel @ d; m = pr > 0.94 * dist; rad[j, i] = (pr[m].max() if m.any() else 0.1) + 0.007
    for _ in range(2): rad = (np.roll(rad, 1, 1) + rad * 2 + np.roll(rad, -1, 1)) / 4
    rad[NV, :] = rad[NV, :].mean()
    bm = bmesh.new(); rows = []
    for j in range(NV + 1):
        ph = (j / NV) * math.pi / 2
        rows.append([bm.verts.new((c0 + rad[j, i] * np.array([math.cos(ph) * math.cos(2 * math.pi * i / NU), math.cos(ph) * math.sin(2 * math.pi * i / NU), math.sin(ph)])).tolist()) for i in range(NU)])
    for j in range(NV):
        for i in range(NU): bm.faces.new([rows[j][i], rows[j][(i + 1) % NU], rows[j + 1][(i + 1) % NU], rows[j + 1][i]])
    # つば: 前 (-Y) に張り出す
    NB_ = 16; inner = []; outer = []
    for i in range(NB_ + 1):
        a = math.pi * (1.12 + 0.76 * i / NB_); c, s_ = math.cos(a), math.sin(a); e = 0.08 * math.sin(math.pi * i / NB_) ** 0.6
        r_ = np.interp((a / (2 * math.pi) * NU) % NU, np.arange(NU + 1), np.append(rad[0], rad[0, 0])) - 0.003
        inner.append((c0[0] + r_ * c, c0[1] + r_ * s_, zc + 0.003)); outer.append((c0[0] + (r_ + e * 0.3) * c, c0[1] + (r_ + e) * s_, zc + 0.003 - 0.016 * math.sin(math.pi * i / NB_)))
    vi = [bm.verts.new(v) for v in inner]; vo = [bm.verts.new(v) for v in outer]
    for i in range(NB_): bm.faces.new([vi[i], vo[i], vo[i + 1], vi[i + 1]])
    return prop('cap', bm, flat_mat('cap', (0x17, 0xa8, 0x9a)))
def make_glasses():
    ev = wco(meshes['eyes']); bv = wco(meshes['body']); bm = bmesh.new(); R = 0.0245; cen = {}
    ez = ev[:, 2].mean(); brow = bv[(abs(bv[:, 0]) < 0.05) & (bv[:, 2] > ez + 0.008) & (bv[:, 2] < ez + 0.03)]
    gy = brow[:, 1].min() - 0.004
    for sx in (1, -1):
        e = ev[ev[:, 0] * sx > 0]; c = np.array([e[:, 0].mean(), gy, e[:, 2].mean() - 0.002]); cen[sx] = c
        tube(bm, [c + R * np.array([math.cos(2 * math.pi * i / 28), 0, math.sin(2 * math.pi * i / 28)]) for i in range(28)], 0.0017, closed=True)
        side = bv[(bv[:, 2] > ez - 0.02) & (bv[:, 2] < ez + 0.02) & (bv[:, 1] < gy + 0.09)]; ear_x = sx * (abs(side[:, 0]).max() + 0.002)
        hinge = c + np.array([sx * R, 0, 0.004]); tube(bm, [hinge, np.array([ear_x, gy + 0.02, ez + 0.006]), np.array([ear_x, gy + 0.105, ez + 0.006]), np.array([ear_x * 0.98, gy + 0.125, ez - 0.01])], 0.0014)
    a, b = cen[-1] + np.array([R, 0, 0.006]), cen[1] + np.array([-R, 0, 0.006])
    tube(bm, [a, (a + b) / 2 + np.array([0, -0.001, 0.004]), b], 0.0016)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return prop('glasses', bm, flat_mat('glasses', (0x22, 0x24, 0x2a)))
bpy.context.view_layer.update(); make_cap(); make_glasses()

# ───────────────────────── 4. 骨の計算 (numpy) ─────────────────────────
BONES = [b.name for b in rig.data.bones]                       # 親が先に来る順
PARENT = {b.name: (b.parent.name if b.parent else None) for b in rig.data.bones}
REST = {b.name: np.array(b.matrix_local) for b in rig.data.bones}    # 4x4 (アーマチュア空間 = ワールド)
RR = {b: REST[b][:3, :3] for b in BONES}
LOCAL = {b: (np.linalg.inv(REST[PARENT[b]]) @ REST[b] if PARENT[b] else REST[b]) for b in BONES}
MAIN = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head'] + [n + s for s in ('_l', '_r') for n in
        ('clavicle', 'upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot', 'ball')]
FINGERS = [b for b in BONES if b not in MAIN and b != 'Root']
def head_of(b): return REST[b][:3, 3]
def unit(v): v = np.asarray(v, float); return v / (np.linalg.norm(v) + 1e-12)
def rmin(a, b):
    """単位ベクトル a を b に重ねる最小の回転"""
    a, b = unit(a), unit(b); v = np.cross(a, b); c = float(a @ b)
    if c < -0.999999: ax = unit(np.cross(a, [1, 0, 0]) if abs(a[0]) < 0.9 else np.cross(a, [0, 1, 0])); return raxis(ax, math.pi)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]); return np.eye(3) + vx + vx @ vx / (1 + c)
def raxis(ax, ang):
    ax = unit(ax); x, y, z = ax; c, s = math.cos(ang), math.sin(ang); C = 1 - c
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])
def rz(deg): return raxis([0, 0, 1], math.radians(deg))
def rx(deg): return raxis([1, 0, 0], math.radians(deg))
def ry(deg): return raxis([0, 1, 0], math.radians(deg))
def q_of(m): return np.array(Matrix(m.tolist()).to_quaternion())
def m_of(q): return np.array(Quaternion(q.tolist()).to_matrix())
def slerp(a, b, t): return np.array(Quaternion(a.tolist()).slerp(Quaternion(b.tolist()), t))

class Pose:
    """W: MAIN の骨のワールド回転 (3x3)、p: pelvis のワールド位置、F: 指の骨のローカル回転 (basis, 3x3)"""
    def __init__(s, W=None, p=None, F=None):
        s.W = {b: RR[b].copy() for b in MAIN} if W is None else {b: m.copy() for b, m in W.items()}
        s.p = head_of('pelvis').copy() if p is None else np.array(p, float)
        s.F = {b: np.eye(3) for b in FINGERS} if F is None else {b: m.copy() for b, m in F.items()}
    def copy(s): return Pose(s.W, s.p, s.F)
    def joints(s):
        """→ 全骨のワールド行列 4x4"""
        M = {'Root': REST['Root'].copy()}
        for b in BONES:
            if b == 'Root': continue
            m = M[PARENT[b]] @ LOCAL[b]
            if b in s.W: m[:3, :3] = s.W[b]
            else: m[:3, :3] = m[:3, :3] @ s.F[b]
            if b == 'pelvis': m[:3, 3] = s.p
            M[b] = m
        return M
    def basis(s):
        """→ {bone: (quat wxyz, loc or None)} Blender の pose bone に書く値"""
        M = s.joints(); out = {}
        for b in BONES:
            if b == 'Root': continue
            pl = M[PARENT[b]] @ LOCAL[b]
            r = pl[:3, :3].T @ M[b][:3, :3]
            out[b] = (q_of(r), (pl[:3, :3].T @ (s.p - pl[:3, 3])) if b == 'pelvis' else None)
        return out
    def ik(s, upper, lower, end, target, keep_end=True):
        """2 骨 IK: end の骨の頭を target に置く。ひじ・ひざの向きは今の姿勢から取る"""
        M = s.joints(); H, K, A = M[upper][:3, 3], M[lower][:3, 3], M[end][:3, 3]
        l1, l2 = np.linalg.norm(K - H), np.linalg.norm(A - K); t = np.asarray(target, float) - H
        d = min(max(np.linalg.norm(t), abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995); n = unit(t)
        pole = (K - H) - n * ((K - H) @ n)
        if np.linalg.norm(pole) < 1e-5: pole = (A - K) - n * ((A - K) @ n); pole = -pole
        pole = unit(pole); ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d); sa = math.sqrt(max(0, 1 - ca * ca))
        Kn = H + n * (l1 * ca) + pole * (l1 * sa); An = H + n * d
        r1 = rmin(K - H, Kn - H); s.W[upper] = r1 @ s.W[upper]
        r2 = rmin(r1 @ (A - K), An - Kn); s.W[lower] = r2 @ r1 @ s.W[lower]
        if not keep_end: s.W[end] = r2 @ r1 @ s.W[end]
        return s
    def turn(s, bones, R, pivot=None):
        """骨とその子孫 (MAIN) をワールド回転 R だけ回す"""
        for b in MAIN:
            a = b
            while a and a not in bones: a = PARENT[a]
            if a: s.W[b] = R @ s.W[b]
        return s

def blend(a, b, t):
    c = a.copy(); c.p = a.p * (1 - t) + b.p * t
    for k_ in a.W: c.W[k_] = m_of(slerp(q_of(a.W[k_]), q_of(b.W[k_]), t))
    for k_ in a.F: c.F[k_] = m_of(slerp(q_of(a.F[k_]), q_of(b.F[k_]), t))
    return c
def smooth(t): t = min(max(t, 0.0), 1.0); return t * t * (3 - 2 * t)

# ───────────────────────── 5. モーションキャプチャ (CMU, BVH) のリターゲット ─────────────────────────
def parse_bvh(path):
    """→ names, parent, dt, pos[F,n,3], rot[F,n,3,3]。BVH 座標 (Y 上、+Z 正面)"""
    toks = open(path).read().split()
    i = 0; names = []; parent = []; offset = []; chans = []; stack = []; end = False
    while toks[i] != 'MOTION':
        t = toks[i]
        if t in ('ROOT', 'JOINT'):
            names.append(toks[i + 1]); parent.append(stack[-1] if stack else -1); offset.append(None); chans.append([]); i += 2
        elif t == 'End': end = True; i += 2
        elif t == '{': stack.append(len(names) - 1 if not end else -2); i += 1
        elif t == '}': stack.pop(); end = False; i += 1
        elif t == 'OFFSET':
            v = [float(x) for x in toks[i + 1:i + 4]]
            if not end: offset[len(names) - 1] = v
            else: names.append(names[stack[-2]] + '_end'); parent.append(stack[-2]); offset.append(v); chans.append([])
            i += 4
        elif t == 'CHANNELS':
            n = int(toks[i + 1]); chans[len(names) - 1] = toks[i + 2:i + 2 + n]; i += 2 + n
        else: i += 1
    F = int(toks[i + 2]); dt = float(toks[i + 5]); i += 6
    nch = sum(len(c) for c in chans)
    data = np.array(toks[i:i + F * nch], dtype=float).reshape(F, nch)
    n = len(names); offset = np.array(offset); pos = np.zeros((F, n, 3)); rot = np.zeros((F, n, 3, 3)); col = 0
    def R(axis, a):
        c, s = np.cos(a), np.sin(a); m = np.zeros((len(a), 3, 3)); j = 'XYZ'.index(axis); m[:, j, j] = 1
        k_, l = (j + 1) % 3, (j + 2) % 3; m[:, k_, k_] = c; m[:, l, l] = c; m[:, k_, l] = -s; m[:, l, k_] = s; return m
    for b in range(n):
        loc = np.tile(offset[b], (F, 1)); r = np.tile(np.eye(3), (F, 1, 1))
        for c in chans[b]:
            v = data[:, col]; col += 1
            if c.endswith('position'): loc[:, 'XYZ'.index(c[0])] = v
            else: r = r @ R(c[0], np.radians(v))
        p = parent[b]
        if p < 0: pos[:, b] = loc; rot[:, b] = r
        else: pos[:, b] = pos[:, p] + np.einsum('fij,fj->fi', rot[:, p], loc); rot[:, b] = rot[:, p] @ r
    return dict(names=names, parent=parent, dt=dt, pos=pos, rot=rot)

CV = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)      # BVH (x, y, z) → Blender (x, -z, y)
SRC = {'pelvis': 'Hips', 'spine_01': 'LowerBack', 'spine_02': 'Spine', 'spine_03': 'Spine1', 'neck_01': 'Neck1', 'head': 'Head'}
for s_, S_ in (('_l', 'Left'), ('_r', 'Right')):
    SRC.update({'clavicle' + s_: S_ + 'Shoulder', 'upperarm' + s_: S_ + 'Arm', 'lowerarm' + s_: S_ + 'ForeArm', 'hand' + s_: S_ + 'Hand',
                'thigh' + s_: S_ + 'UpLeg', 'calf' + s_: S_ + 'Leg', 'foot' + s_: S_ + 'Foot', 'ball' + s_: S_ + 'ToeBase'})
ALIGN = {}                                                    # T ポーズで向きを合わせる骨 → (元の関節, その先の関節)
for s_, S_ in (('_l', 'Left'), ('_r', 'Right')):
    ALIGN.update({'upperarm' + s_: (S_ + 'Arm', S_ + 'ForeArm'), 'lowerarm' + s_: (S_ + 'ForeArm', S_ + 'Hand'), 'hand' + s_: (S_ + 'ForeArm', S_ + 'Hand'),
                  'thigh' + s_: (S_ + 'UpLeg', S_ + 'Leg'), 'calf' + s_: (S_ + 'Leg', S_ + 'Foot')})
ANKLE0 = {s_: head_of('foot' + s_)[2] for s_ in ('_l', '_r')}
LEG = sum(np.linalg.norm(head_of(a) - head_of(b)) for a, b in (('thigh_l', 'calf_l'), ('calf_l', 'foot_l')))
_bvh = {}
def mocap(name, t0, t1, yaw=0.0, origin='start', inplace=False, fingers=None, hscale=1.0):
    """BVH の [t0, t1] 秒 (T ポーズのコマを除いた時刻) を 30fps の Pose 列にする。yaw: 鉛直まわりに回す角度 (度)"""
    if name not in _bvh: _bvh[name] = parse_bvh(os.path.join(args.bvh, name + '.bvh'))
    B = _bvh[name]; nm = B['names']; ix = nm.index; pos = B['pos'] @ CV.T; rot = CV @ B['rot'] @ CV.T
    sleg = sum(np.linalg.norm(pos[0, ix(a)] - pos[0, ix(b)]) for a, b in (('LeftUpLeg', 'LeftLeg'), ('LeftLeg', 'LeftFoot')))
    kk = LEG / sleg; a0 = pos[0, ix('LeftFoot'), 2]
    TREF = {}
    for b in MAIN:
        TREF[b] = RR[b]
        if b in ALIGN: TREF[b] = rmin(RR[b][:, 1], pos[0, ix(ALIGN[b][1])] - pos[0, ix(ALIGN[b][0])]) @ RR[b]
    n = int(round((t1 - t0) * FPS)) + 1; out = []
    fr = [min(1 + int(round((t0 + i / FPS) / B['dt'])), len(pos) - 1) for i in range(n)]
    if yaw == 'auto':                             # 最初のコマで正面 (-Y) を向かせる
        fwd = rot[fr[0], ix('Hips')] @ rot[0, ix('Hips')].T @ np.array([0, -1.0, 0]); yaw = math.degrees(math.atan2(fwd[0], -fwd[1]))
    elif yaw == 'travel':                         # 進む向きを正面にする
        fwd = pos[fr[-1], ix('Hips')] - pos[fr[0], ix('Hips')]; yaw = math.degrees(math.atan2(fwd[0], -fwd[1]))
    elif isinstance(yaw, tuple):                  # ('throw', 秒): その時刻の右手の速度の向きを正面にする
        fa = 1 + int(round(yaw[1] / B['dt'])); fwd = pos[fa + 4, ix('RightHand')] - pos[fa - 4, ix('RightHand')]; yaw = math.degrees(math.atan2(fwd[0], -fwd[1]))
    G = rz(yaw)
    def tgt(f, j, z0):
        v = pos[f, ix(j)]; return G @ np.array([v[0] * kk * hscale, v[1] * kk * hscale, 0]) + np.array([0, 0, max((v[2] - a0) * kk, 0.0) + z0])
    o = tgt(fr[0], 'Hips', 0) * np.array([1, 1, 0])
    if origin == 'feet': o = (tgt(fr[0], 'LeftFoot', 0) + tgt(fr[0], 'RightFoot', 0)) / 2 * np.array([1, 1, 0])
    vel = (tgt(fr[-1], 'Hips', 0) - tgt(fr[0], 'Hips', 0)) * np.array([1, 1, 0]) / max(n - 1, 1) if inplace else np.zeros(3)
    for i, f in enumerate(fr):
        P = Pose(F=fingers)
        for b in MAIN: P.W[b] = G @ rot[f, ix(SRC[b])] @ rot[0, ix(SRC[b])].T @ TREF[b]
        P.p = tgt(f, 'Hips', ANKLE0['_l']) - o - vel * i
        for s_, S_ in (('_l', 'Left'), ('_r', 'Right')):
            a = tgt(f, S_ + 'Foot', ANKLE0[s_]) - o - vel * i
            P.ik('thigh' + s_, 'calf' + s_, 'foot' + s_, a)
            # 足が地面に近いときは足裏を水平に寄せる (CMU の足首はつま先が浮きやすい)
            w = 1 - smooth((a[2] - ANKLE0[s_] - 0.015) / 0.08)
            if w > 0:
                c, r0 = P.W['foot' + s_][:, 1], RR['foot' + s_][:, 1]; flat = rz(math.degrees(math.atan2(c[1], c[0]) - math.atan2(r0[1], r0[0])))
                for b in ('foot' + s_, 'ball' + s_): P.W[b] = m_of(slerp(q_of(P.W[b]), q_of(flat @ RR[b]), w))
        out.append(P)
    return out

def make_loop(poses, n=None):
    """最後のコマが最初のコマに重なるように、差を全体にならして配る (ループ用)。返り値は最後のコマを除いた列"""
    a, b = poses[0], poses[-1]; N = len(poses) - 1; out = []
    for i, P in enumerate(poses[:-1]):
        u = i / N; Q = P.copy(); Q.p = P.p + (a.p - b.p) * u
        for k_ in P.W: Q.W[k_] = m_of(slerp(np.array([1.0, 0, 0, 0]), q_of(a.W[k_] @ b.W[k_].T), u)) @ P.W[k_]
        out.append(Q)
    return out

# ───────────────────────── 6. クリップ ─────────────────────────
CLIPS = {}      # name → dict(poses=[Pose], loop=bool)
META = {'fps': FPS, 'clips': {}, 'height': HEIGHT}
#CLIPS_BEGIN
for i_, e_ in enumerate(args.explore):
    a_ = e_.split(':'); CLIPS['x%d' % i_] = dict(poses=mocap(a_[0], float(a_[1]), float(a_[2]), float(a_[3]) if len(a_) > 3 else 'auto'), loop=False)
if not args.explore and not args.static:
    # --- 指 ---
    BLEN = {b.name: b.length for b in rig.data.bones}
    def tail_of(M, b): return M[b][:3, 3] + M[b][:3, 1] * BLEN[b]
    def finger_axes():
        ax = {}
        for s_ in ('_l', '_r'):
            Fd = unit(head_of('middle_01' + s_) - head_of('hand' + s_)); Td = unit(head_of('index_01' + s_) - head_of('pinky_01' + s_))
            N = unit(np.cross(Fd, Td)) if s_ == '_l' else unit(np.cross(Td, Fd))        # 手のひらが向く側
            for f in ('index', 'middle', 'ring', 'pinky'):
                for i in (1, 2, 3):
                    b = '%s_0%d%s' % (f, i, s_); ax[b] = RR[b].T @ unit(np.cross(RR[b][:, 1], N))
            for i in (1, 2, 3):
                b = 'thumb_0%d%s' % (i, s_); to = unit(head_of('index_02' + s_) - head_of('thumb_02' + s_))
                ax[b] = RR[b].T @ unit(np.cross(RR[b][:, 1], to))
            ax['N' + s_] = N
        return ax
    FAX = finger_axes()
    def fingers(left, right):
        """各指の曲げ角 (度) {指: (根元, 中, 先)} → 指の骨のローカル回転"""
        F = {b: np.eye(3) for b in FINGERS}
        for s_, spec in (('_l', left), ('_r', right)):
            for f, angs in spec.items():
                for i, a in enumerate(angs): b = '%s_0%d%s' % (f, i + 1, s_); F[b] = raxis(FAX[b], math.radians(a))
        return F
    RELAX = dict(index=(12, 18, 12), middle=(18, 24, 16), ring=(24, 28, 18), pinky=(28, 30, 18), thumb=(8, 6, 6))
    PINCH = dict(index=(38, 52, 30), middle=(62, 78, 50), ring=(72, 84, 55), pinky=(78, 86, 55), thumb=(26, 14, 22))
    F_RELAX = fingers(RELAX, RELAX); F_PINCH = fingers(RELAX, PINCH)

    # --- 基本の立ち姿 (腕を下ろす、足は肩幅より少し狭く) ---
    def hand_frame(P, s_, fdir, ndir):
        """手の向きを決める: fdir=指先の向き、ndir=手のひらが向く側 (ワールド)"""
        F0 = unit(RR['hand' + s_][:, 1]); N0 = FAX['N' + s_]; N0 = unit(N0 - F0 * (N0 @ F0))
        F1 = unit(fdir); N1 = unit(np.asarray(ndir, float) - F1 * (np.asarray(ndir, float) @ F1))
        A = np.stack([F0, N0, np.cross(F0, N0)], 1); B_ = np.stack([F1, N1, np.cross(F1, N1)], 1)
        P.W['hand' + s_] = B_ @ A.T @ RR['hand' + s_]
    def stance():
        P = Pose(F=F_RELAX)
        for s_, sx in (('_l', 1), ('_r', -1)):
            P.W['upperarm' + s_] = rmin(RR['upperarm' + s_][:, 1], [0.13 * sx, 0.04, -1]) @ RR['upperarm' + s_]
            P.W['lowerarm' + s_] = rmin(RR['lowerarm' + s_][:, 1], [0.10 * sx, -0.22, -1]) @ RR['lowerarm' + s_]
            hand_frame(P, s_, [0.04 * sx, -0.30, -1], [-sx, 0.35, 0])
            P.W['clavicle' + s_] = raxis([0, 1, 0], math.radians(4 * sx)) @ RR['clavicle' + s_]
        dx = abs(head_of('thigh_l')[0] - 0.105); dy = head_of('thigh_l')[1] - head_of('foot_l')[1]      # ひざがほぼ伸びる高さに腰を置く
        P.p = head_of('pelvis') + np.array([0, 0, ANKLE0['_l'] + math.sqrt((LEG * 0.992) ** 2 - dx * dx - dy * dy) - head_of('thigh_l')[2]])
        for s_, sx in (('_l', 1), ('_r', -1)):
            a = head_of('foot' + s_).copy(); a[0] = 0.105 * sx
            yaw = rz(-5 * sx)     # つま先の開きを少し戻す
            P.W['foot' + s_] = yaw @ P.W['foot' + s_]; P.W['ball' + s_] = yaw @ P.W['ball' + s_]
            P.ik('thigh' + s_, 'calf' + s_, 'foot' + s_, a)
        return P
    S0 = stance(); print('palm normal L (rest)', np.round(FAX['N_l'], 2), 'S0 pelvis', np.round(S0.p, 3))
    ANK = {s_: S0.joints()['foot' + s_][:3, 3].copy() for s_ in ('_l', '_r')}
    def plant(P):
        for s_ in ('_l', '_r'): P.ik('thigh' + s_, 'calf' + s_, 'foot' + s_, ANK[s_])
        return P
    def breathe(P, ph, amp=1.0):
        """呼吸と小さな重心移動。ph: 0..1 の位相 (1 周期でちょうど元に戻る)"""
        w = 2 * math.pi * ph; b = math.sin(w); P = P.copy()
        P.turn(['spine_02'], rx(-0.7 * amp * b)); P.turn(['spine_03'], rx(-0.6 * amp * b)); P.turn(['neck_01'], rx(0.9 * amp * b))
        P.turn(['clavicle_l'], ry(0.8 * amp * b)); P.turn(['clavicle_r'], ry(-0.8 * amp * b))
        P.turn(['spine_01'], rz(0.5 * amp * math.sin(w + 1.0)) @ ry(0.4 * amp * math.sin(w + 0.4)))
        P.p = P.p + np.array([0.004 * amp * math.sin(w + 0.4), 0.002 * amp * math.sin(w), 0.0025 * amp * b])
        return plant(P)

    # --- hold: 右手を胸の前に ---
    def hold_pose():
        P = S0.copy(); P.F = F_PINCH
        P.W['upperarm_r'] = rmin(RR['upperarm_r'][:, 1], [-0.30, 0.12, -1]) @ RR['upperarm_r']
        P.W['lowerarm_r'] = rmin(RR['lowerarm_r'][:, 1], [0.35, -0.9, 0.35]) @ RR['lowerarm_r']
        P.ik('upperarm_r', 'lowerarm_r', 'hand_r', [-0.17, -0.30, 1.20])
        hand_frame(P, '_r', [0.10, -0.62, 0.78], [0.95, 0.15, -0.25])
        P.turn(['head'], rx(4)); return P
    HOLD = hold_pose()

    # --- hand_R_attach: hold の姿勢で、親指と人差し指の先の間。その姿勢で軸がワールド (glTF) と平行になる向き ---
    def add_attach():
        M = HOLD.joints(); pt = (tail_of(M, 'thumb_03_r') + tail_of(M, 'index_03_r')) / 2
        A = np.eye(4); A[:3, :3] = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float); A[:3, 3] = pt
        rest = REST['hand_r'] @ np.linalg.inv(M['hand_r']) @ A
        sel(rig); bpy.ops.object.mode_set(mode='EDIT')
        eb = rig.data.edit_bones.new('hand_R_attach'); eb.head = Vector(rest[:3, 3].tolist()); eb.tail = Vector((rest[:3, 3] + rest[:3, 1] * 0.03).tolist())
        eb.matrix = Matrix(rest.tolist()); eb.parent = rig.data.edit_bones['hand_r']; eb.use_connect = False; eb.use_deform = False
        bpy.ops.object.mode_set(mode='OBJECT')
        return np.linalg.inv(M['hand_r']) @ A          # 手の骨から見た目印の行列
    ATT = add_attach()
    def attach_pos(P): return (P.joints()['hand_r'] @ ATT)[:3, 3]
    def to_gltf(v): return [round(float(v[0]), 4), round(float(v[2]), 4), round(float(-v[1]), 4)]

    N2 = 2 * FPS
    CLIPS['idle'] = dict(poses=[breathe(S0, i / N2) for i in range(N2)], loop=True)
    CLIPS['hold'] = dict(poses=[breathe(HOLD, i / N2, 0.8) for i in range(N2)], loop=True)

    # throw: CMU 124_01 (野球の投球)。最初の 0.3 秒で hold の姿勢からつなぐ。手の速さが最大のコマを「手を離す時刻」にする
    T_REL = 3.72
    mc = mocap('124_01', 2.65, 4.0, yaw=('throw', T_REL), origin='feet', hscale=0.75, fingers=F_PINCH)
    h0 = CLIPS['hold']['poses'][0]; NB = 9; th = []
    for i, P in enumerate(mc): th.append(blend(h0, P, smooth(i / NB)) if i < NB else P)
    sp = [np.linalg.norm(attach_pos(th[i + 1]) - attach_pos(th[i - 1])) * FPS / 2 for i in range(1, len(th) - 1)]
    irel = 1 + int(np.argmax(sp))
    for i, P in enumerate(th):
        if i > irel: P.F = blend(Pose(F=F_PINCH), Pose(F=F_RELAX), smooth((i - irel) / 4)).F
    CLIPS['throw'] = dict(poses=th, loop=False)
    META['throw_release_time'] = round(irel / FPS, 4); META['throw_release_hand_pos'] = to_gltf(attach_pos(th[irel]))
    META['throw_release_hand_speed'] = round(float(max(sp)), 2); META['throw_end_pelvis_pos'] = to_gltf(th[-1].p)

    def head_clip(n, fn):
        out = []
        for i in range(n + 1):
            yaw, pitch, lean = fn(i / FPS); P = breathe(S0, i / N2, 0.6)
            P.turn(['spine_03'], rz(yaw * 0.12) @ rx(lean)); P.turn(['neck_01'], rz(yaw * 0.33) @ rx(pitch * 0.35)); P.turn(['head'], rz(yaw * 0.55) @ rx(pitch * 0.65))
            out.append(P)
        return out
    def env(t, a, b, c, d): return smooth((t - a) / max(b - a, 1e-6)) * (1 - smooth((t - c) / max(d - c, 1e-6)))
    CLIPS['shake_head'] = dict(poses=head_clip(36, lambda t: (30 * math.sin(2 * math.pi * (t - 0.08) / 0.5) * env(t, 0.05, 0.25, 0.9, 1.15), 5 * env(t, 0, 0.2, 0.95, 1.2), 0)), loop=False)
    CLIPS['look_up'] = dict(poses=head_clip(30, lambda t: (0, -34 * smooth(t / 0.7) + 4 * env(t, 0, 0.12, 0.12, 0.3), -5 * smooth(t / 0.75))), loop=False)

    # wave: CMU 141_16 (手を振る) の上半身を、基本の立ち姿の下半身に重ねる
    UPPER = [b for b in MAIN if b.split('_')[0] in ('spine', 'neck', 'head', 'clavicle', 'upperarm', 'lowerarm', 'hand')]
    F_OPEN = fingers(RELAX, dict(index=(4, 6, 4), middle=(4, 6, 4), ring=(6, 8, 5), pinky=(8, 10, 6), thumb=(0, 0, 0)))
    wv = []
    for M_ in mocap('141_16', 0.40, 1.20, yaw='auto'):
        P = S0.copy(); P.F = F_OPEN; R = S0.W['pelvis'] @ M_.W['pelvis'].T
        for b in UPPER: P.W[b] = R @ M_.W[b]
        wv.append(P)
    CLIPS['wave'] = dict(poses=make_loop(wv), loop=True)

    # walk: CMU 07_01 (歩行) の 1 周期。進んだ分を引いてその場歩きにする
    CLIPS['walk'] = dict(poses=make_loop(mocap('07_01', 0.517, 1.617, yaw='travel', inplace=True, fingers=F_RELAX)), loop=True)
    META['motion_sources'] = {'throw': 'CMU mocap 124_01 (2.65-4.00 s) + blend-in from hold', 'wave': 'CMU mocap 141_16 (0.40-1.20 s), upper body', 'walk': 'CMU mocap 07_01 (0.517-1.617 s)',
                              'idle': 'keyed', 'hold': 'keyed (IK)', 'shake_head': 'keyed', 'look_up': 'keyed'}

#CLIPS_END

# ───────────────────────── 7. Blender に書き込む ─────────────────────────
sc = bpy.context.scene; sc.render.fps = FPS; sc.frame_start = 0
rig.animation_data_create()
for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
for name, c in CLIPS.items():
    poses = c['poses'] + ([c['poses'][0]] if c['loop'] else [])
    act = bpy.data.actions.new(name); rig.animation_data.action = act; prev = {}
    for f, P in enumerate(poses):
        for b, (q, loc) in P.basis().items():
            if b in prev and float(prev[b] @ q) < 0: q = -q
            prev[b] = q; pb = rig.pose.bones[b]
            pb.rotation_quaternion = Quaternion(q.tolist()); pb.keyframe_insert('rotation_quaternion', frame=f)
            if loc is not None: pb.location = Vector(loc.tolist()); pb.keyframe_insert('location', frame=f)
    act.use_fake_user = True; sc.frame_end = max(sc.frame_end, len(poses) - 1)
    META['clips'][name] = {'duration': round((len(poses) - 1) / FPS, 4), 'loop': c['loop']}
rig.animation_data.action = None
for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
rig['throw_release_time'] = META.get('throw_release_time', 0.0)

# ───────────────────────── 8. 書き出しと後処理 ─────────────────────────
glb = os.path.join(args.out, NAME + '.glb')
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in ('MESH', 'ARMATURE'): o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                          export_animations=bool(CLIPS), export_animation_mode='ACTIONS', export_force_sampling=True,
                          export_optimize_animation_size=False, export_skins=True, export_extras=True, export_def_bones=False,
                          export_image_format='AUTO', export_tangents=False, export_cameras=False, export_lights=False)

def fix_glb(path):
    """glTF の JSON を書き換える: 透明の扱い (髪・まゆ・まつ毛・目だけ)、両面、粗さ"""
    d = open(path, 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]; js = json.loads(d[20:20 + jl]); rest = d[20 + jl:]
    for m in js['materials']:
        r = MAT.get(m['name'])
        if not r: continue
        mode, cut, dbl, rough = r
        m['alphaMode'] = mode; m.pop('alphaCutoff', None)
        if cut is not None: m['alphaCutoff'] = cut
        m['doubleSided'] = dbl
        pbr = m.setdefault('pbrMetallicRoughness', {}); pbr['metallicFactor'] = 0.0; pbr['roughnessFactor'] = rough
    out = json.dumps(js, separators=(',', ':')).encode(); out += b' ' * (-len(out) % 4)
    body_ = struct.pack('<II', len(out), 0x4E4F534A) + out + rest
    open(path, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + len(body_)) + body_)
    return js
js = fix_glb(glb)
json.dump(META, open(os.path.join(args.out, NAME + '.meta.json'), 'w'), indent=1)
b64 = base64.b64encode(open(glb, 'rb').read()).decode()
open(glb + '.js', 'w').write('(window.AUTO_ASSET_DATA=window.AUTO_ASSET_DATA||{})["%s.glb"]="%s";\nwindow.AUTO_ASSET_DATA["%s.meta"]=%s;\n' % (NAME, b64, NAME, json.dumps(META)))
print('wrote', glb, os.path.getsize(glb), 'bytes; nodes', len(js['nodes']), 'anims', [a['name'] for a in js.get('animations', [])],
      'images', [(i.get('name'), i.get('mimeType')) for i in js.get('images', [])])
