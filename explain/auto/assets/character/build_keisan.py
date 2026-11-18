#!/usr/bin/env python3
"""計算係 (keisan) キャラクター生成スクリプト。

  python3 -m venv .venv && .venv/bin/pip install bpy numpy   # bpy 5.x (Python 3.13)
  .venv/bin/python build_keisan.py [出力ディレクトリ]

出力: keisan.glb / keisan.glb.js (base64 同梱) / keisan.meta.json / paper_plane.glb / paper_plane.glb.js

座標はすべて Blender 系 (x=キャラの左, -y=正面, z=上) で書いてある。glTF 書き出しで
(x, z, -y) になり、正面 +Z・上 +Y になる。乱数は使っていない (完全に決定的)。
体型・衣装を変えるときは「寸法」「色」「メッシュ」の節、動きは「クリップ」の節を触る。
"""
import sys, os, json, base64, math
import numpy as np
import bpy, bmesh
from mathutils import Matrix, Vector

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__)))
FPS = 30
sin, cos, pi = math.sin, math.cos, math.pi
V = lambda *a: np.array(a, dtype=float)

# ───────────────────────── 寸法 (関節の位置) ─────────────────────────
J = {
    'hips': V(0, 0, 0.64), 'spine1': V(0, 0, 0.78), 'spine2': V(0, 0, 0.96),
    'neck': V(0, 0, 1.19), 'head': V(0, 0, 1.25),
}
for s, sg in (('L', 1), ('R', -1)):
    J['shoulder_' + s] = V(sg * 0.05, 0, 1.15)
    J['upper_arm_' + s] = V(sg * 0.192, 0, 1.14)
    J['forearm_' + s] = V(sg * 0.192, 0, 0.94)
    J['hand_' + s] = V(sg * 0.192, 0, 0.745)
    J['thigh_' + s] = V(sg * 0.085, 0, 0.60)
    J['shin_' + s] = V(sg * 0.085, 0, 0.34)
    J['foot_' + s] = V(sg * 0.085, 0, 0.085)
J['hand_R_attach'] = V(-0.164, -0.03, 0.66)   # 右の手のひら (親指と手のひらの間)
PARENT = {'hips': None, 'spine1': 'hips', 'spine2': 'spine1', 'neck': 'spine2', 'head': 'neck', 'hand_R_attach': 'hand_R'}
for s in 'LR':
    PARENT.update({'shoulder_' + s: 'spine2', 'upper_arm_' + s: 'shoulder_' + s, 'forearm_' + s: 'upper_arm_' + s,
                   'hand_' + s: 'forearm_' + s, 'thigh_' + s: 'hips', 'shin_' + s: 'thigh_' + s, 'foot_' + s: 'shin_' + s})
BONES = ['hips', 'spine1', 'spine2', 'neck', 'head'] + [b + s for s in ('_L', '_R') for b in ('shoulder', 'upper_arm', 'forearm', 'hand')] \
    + [b + s for s in ('_L', '_R') for b in ('thigh', 'shin', 'foot')] + ['hand_R_attach']
BALL = V(0, -0.10, -0.085)     # 足首から見た母指球 (接地点)
HEAD_C, HEAD_R = V(0, 0, 1.45), V(0.2, 0.19, 0.21)

# ───────────────────────── 色 ─────────────────────────
MATS = {  # name: (hex, roughness)
    'coat': ('#e6e9ee', 0.85), 'skin': ('#f2c9a5', 0.7), 'cap': ('#17a89a', 0.75), 'brim': ('#12867b', 0.75),
    'pants': ('#1f2a4d', 0.85), 'shoe': ('#2a2c36', 0.6), 'sole': ('#e6e6e6', 0.8), 'hair': ('#3b2a22', 0.8),
    'glass': ('#1c2230', 0.35), 'eye': ('#15161c', 0.3), 'white': ('#ffffff', 0.3), 'mouth': ('#9c4038', 0.7),
    'seam': ('#b9bec9', 0.85), 'button': ('#1f2a4d', 0.5),
}
MAT_IDX = {k: i for i, k in enumerate(MATS)}

# ───────────────────────── メッシュの部品 ─────────────────────────
def sm(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)

class Builder:
    def __init__(s): s.v, s.f, s.m, s.w = [], [], [], []
    def loft(s, rings, mat, wfn, cap0=True, cap1=True, loop=False):
        rings = np.asarray(rings, float); K, n, _ = rings.shape; base = len(s.v)
        for p in rings.reshape(-1, 3): s.v.append(tuple(p)); s.w.append(wfn(p))
        mi = MAT_IDX[mat]
        for k in range(K if loop else K - 1):
            a, b = base + k * n, base + ((k + 1) % K) * n
            for j in range(n):
                j2 = (j + 1) % n; s.f.append((a + j, a + j2, b + j2, b + j)); s.m.append(mi)
        if not loop:
            for flag, k in ((cap0, 0), (cap1, K - 1)):
                if not flag: continue
                c = rings[k].mean(0); ci = len(s.v); s.v.append(tuple(c)); s.w.append(wfn(c)); a = base + k * n
                for j in range(n): s.f.append((ci, a + j, a + (j + 1) % n)); s.m.append(mi)

def ring_xy(cx, cy, z, rx, ry, n, e=2.0):
    t = np.arange(n) * 2 * pi / n; c, sn = np.cos(t), np.sin(t)
    return np.stack([cx + rx * np.sign(c) * np.abs(c) ** (2 / e), cy + ry * np.sign(sn) * np.abs(sn) ** (2 / e), np.full(n, z)], 1)

def crom(P, sub):
    """Catmull-Rom で制御点列を細かくする (行=制御点)。"""
    P = np.asarray(P, float); out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for k in range(sub):
            u = k / sub
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    out.append(P[-1]); return np.array(out)

def vloft(B, prof, n, sub, mat, wfn, e=2.0, **kw):
    """縦方向の回転体もどき。prof の行 = (z, cx, cy, rx, ry)。"""
    B.loft([ring_xy(cx, cy, z, max(rx, 1e-4), max(ry, 1e-4), n, e) for z, cx, cy, rx, ry in crom(prof, sub)], mat, wfn, **kw)

def ellipsoid(B, c, r, mat, wfn, R=None, nu=20, nv=12, ev=2.0, deform=None):
    rings = []
    for i in range(1, nv):
        ph = -pi / 2 + pi * i / nv; cz, sz = cos(ph), sin(ph)
        cz, sz = abs(cz) ** (2 / ev), math.copysign(abs(sz) ** (2 / ev), sz)
        t = np.arange(nu) * 2 * pi / nu
        L = np.stack([r[0] * cz * np.cos(t), r[1] * cz * np.sin(t), np.full(nu, r[2] * sz)], 1)
        if deform is not None: L = deform(L)
        if R is not None: L = L @ np.asarray(R).T
        rings.append(L + c)
    # 極は cap の中心点になるので、わずかに外へ出して丸くする
    B.loft(rings, mat, wfn)
    for sgn, ci in ((-1, -2), (1, -1)):  # loft が最後に足した 2 つの中心点を極へ動かす
        L = np.array([[0, 0, sgn * r[2]]])
        if deform is not None: L = deform(L)
        if R is not None: L = L @ np.asarray(R).T
        B.v[ci] = tuple(L[0] + c)

def tube(B, path, rad, mat, wfn, n=8, up=V(0, 0, 1), loop=False):
    path = np.asarray(path, float); m = len(path); rad = np.broadcast_to(np.asarray(rad, float).reshape(-1, 1) if np.ndim(rad) else rad, (m, 1)) if np.ndim(rad) <= 1 else np.asarray(rad)
    rings = []
    for i in range(m):
        a, b = path[(i - 1) % m if loop else max(i - 1, 0)], path[(i + 1) % m if loop else min(i + 1, m - 1)]
        t = (b - a) / np.linalg.norm(b - a); nn = up - up.dot(t) * t; nn /= np.linalg.norm(nn); bb = np.cross(t, nn)
        r0, r1 = (rad[i][0], rad[i][-1])
        th = np.arange(n) * 2 * pi / n
        rings.append(path[i] + np.outer(np.cos(th) * r0, nn) + np.outer(np.sin(th) * r1, bb))
    B.loft(rings, mat, wfn, loop=loop)

def rx(a): c, s = cos(a), sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def ry(a): c, s = cos(a), sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rz(a): c, s = cos(a), sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
D2R = pi / 180

# ───────────────────────── ウェイト ─────────────────────────
def w_rigid(b): return lambda p: {b: 1.0}

def w_torso(p):
    x, y, z = p
    w2 = sm((z - 0.89) / 0.14); w1 = sm((z - 0.70) / 0.16) - w2; w = {'spine2': w2, 'spine1': w1, 'hips': 1 - w1 - w2}
    if z < 0.66:   # 白衣のすそは腿に少しついていく
        s = 0.72 * sm((0.66 - z) / 0.2); wl = sm((x + 0.06) / 0.12); h = w['hips']
        w['hips'] = h * (1 - s); w['thigh_L'] = h * s * wl; w['thigh_R'] = h * s * (1 - wl)
    if z > 1.04 and abs(x) > 0.08:   # 肩まわりは鎖骨に少しついていく
        s = 0.5 * sm((abs(x) - 0.08) / 0.08) * sm((z - 1.04) / 0.08); b = 'shoulder_L' if x > 0 else 'shoulder_R'
        w[b] = w['spine2'] * s; w['spine2'] *= (1 - s)
    if z > 1.17:
        s = sm((z - 1.17) / 0.06) * 0.6; w['neck'] = w['spine2'] * s; w['spine2'] *= (1 - s)
    return w

def w_limb(up, lo, zj, half):
    def f(p):
        s = sm((zj + half - p[2]) / (2 * half)); return {up: 1 - s, lo: s}
    return f

def w_neck(p):
    s = sm((p[2] - 1.20) / 0.08); return {'neck': 1 - s, 'head': s}

# ───────────────────────── メッシュ ─────────────────────────
def head_scale(z):
    t = max(0.0, (HEAD_C[2] - z) / HEAD_R[2]); return 1 - 0.13 * t * t

def face_pt(x, z, off=0.0):
    """顔の表面 (正面側) の点と外向き法線。"""
    s = head_scale(z); dz = z - HEAD_C[2]
    q = 1 - (x / (HEAD_R[0] * s)) ** 2 - (dz / HEAD_R[2]) ** 2
    y = -HEAD_R[1] * s * math.sqrt(max(q, 0.0))
    n = V(x / (HEAD_R[0] * s) ** 2, y / (HEAD_R[1] * s) ** 2, dz / HEAD_R[2] ** 2); n /= np.linalg.norm(n)
    return V(x, y, z) + n * off, n

def face_frame(n):
    ey = -n; ez = V(0, 0, 1) - ey[2] * ey; ez /= np.linalg.norm(ez); ex = np.cross(ey, ez)
    return np.stack([ex, ey, ez], 1)

def build_mesh():
    B = Builder()
    # 胴 (白衣)。上は襟の中、下はすその内側で閉じる
    coat = [(0.47, 0, 0.004, 0.150, 0.100), (0.41, 0, 0.004, 0.176, 0.126), (0.395, 0, 0.004, 0.19, 0.14), (0.43, 0, 0.004, 0.192, 0.142),
            (0.60, 0, 0.004, 0.178, 0.128), (0.82, 0, 0, 0.156, 0.110), (1.00, 0, 0, 0.166, 0.118), (1.09, 0, 0, 0.172, 0.114),
            (1.15, 0, 0, 0.166, 0.102), (1.19, 0, 0, 0.118, 0.08), (1.215, 0, 0, 0.066, 0.06)]
    vloft(B, coat, 44, 5, 'coat', w_torso, e=2.3)
    def torso_front(z):   # 前面の y (飾りを載せる)
        zs = [c[0] for c in coat[2:]]; ys = [c[2] - c[4] for c in coat[2:]]; return float(np.interp(z, zs, ys))
    # 前合わせの線、ボタン、ネクタイ、ペン
    zs = np.linspace(0.42, 1.12, 26)
    tube(B, [V(0.0, torso_front(z) - 0.001, z) for z in zs], 0.0035, 'seam', w_torso, n=6, up=V(1, 0, 0))
    for z in (0.62, 0.78, 0.94):
        ellipsoid(B, V(0.03, torso_front(z) - 0.002, z), V(0.013, 0.006, 0.013), 'button', w_torso, nu=12, nv=6)
    ellipsoid(B, V(0, torso_front(1.1) - 0.002, 1.105), V(0.03, 0.01, 0.075), 'cap', w_torso, nu=12, nv=10,
              deform=lambda L: L * np.stack([1 + 0.45 * np.clip(L[:, 2] / 0.075, -1, 1) - 0.9 * np.clip(-L[:, 2] / 0.075 - 0.6, 0, 1), np.ones(len(L)), np.ones(len(L))], 1))
    tube(B, [V(0.095, torso_front(z) - 0.004, z) for z in np.linspace(1.0, 1.07, 5)], 0.007, 'brim', w_torso, n=8, up=V(1, 0, 0))
    # えり (シャツ)
    vloft(B, [(1.185, 0, 0, 0.05, 0.05), (1.19, 0, 0, 0.076, 0.07), (1.215, 0, 0, 0.074, 0.068), (1.24, 0, -0.002, 0.064, 0.06), (1.235, 0, 0, 0.05, 0.05)],
          24, 3, 'cap', lambda p: {'neck': 0.6, 'spine2': 0.4})
    # 首
    vloft(B, [(1.16, 0, 0, 0.05, 0.05), (1.22, 0, 0, 0.052, 0.05), (1.30, 0, 0, 0.055, 0.052)], 18, 3, 'skin', w_neck)
    # 腰 (ズボンの上)
    ellipsoid(B, V(0, 0.004, 0.60), V(0.158, 0.112, 0.10), 'pants', w_rigid('hips'), nu=28, nv=12)

    for s, sg in (('L', 1), ('R', -1)):
        ax = sg * 0.192
        # そで: 肩の球 → ひじ → そで口 (内側へ折り返して閉じる)
        wa = w_limb('upper_arm_' + s, 'forearm_' + s, 0.94, 0.05)
        sl = [(1.198, ax, 0, 0.002, 0.002), (1.193, ax, 0, 0.024, 0.024), (1.178, ax, 0, 0.043, 0.043), (1.15, ax, 0, 0.056, 0.056), (1.11, ax, 0, 0.060, 0.060),
              (1.03, ax, 0, 0.060, 0.060), (0.94, ax, 0, 0.057, 0.057), (0.85, ax, 0, 0.056, 0.056), (0.775, ax, 0, 0.058, 0.058),
              (0.757, ax, 0, 0.059, 0.059), (0.752, ax, 0, 0.052, 0.052), (0.775, ax, 0, 0.04, 0.04)]
        B.loft([ring_xy(cx, cy, z, a, b, 22) for z, cx, cy, a, b in np.vstack([crom(sl[:9], 4), sl[9:]])], 'coat', wa)
        # 手首と手 (ミトン型 + 親指)
        wh = w_limb('forearm_' + s, 'hand_' + s, 0.745, 0.025)
        vloft(B, [(0.80, ax, 0, 0.03, 0.033), (0.74, ax, -0.002, 0.029, 0.034), (0.70, ax, -0.004, 0.03, 0.04)], 14, 3, 'skin', wh)
        hb = 'hand_' + s
        ellipsoid(B, V(ax, -0.006, 0.668), V(0.031, 0.047, 0.063), 'skin', w_rigid(hb), nu=18, nv=12, ev=2.4)
        ellipsoid(B, V(ax - sg * 0.012, -0.05, 0.69), V(0.017, 0.019, 0.036), 'skin', w_rigid(hb), R=rx(-0.5), nu=12, nv=8)
        # ズボン
        lx = sg * 0.085
        wl = w_limb('thigh_' + s, 'shin_' + s, 0.34, 0.055)
        pl = [(0.675, lx, 0.004, 0.03, 0.03), (0.655, lx, 0.004, 0.066, 0.07), (0.58, lx, 0.004, 0.080, 0.084), (0.46, lx, 0.004, 0.074, 0.078), (0.34, lx, 0.004, 0.067, 0.07),
              (0.2, lx, 0.004, 0.063, 0.066), (0.085, lx, 0.004, 0.062, 0.066), (0.07, lx, 0.004, 0.062, 0.066), (0.066, lx, 0.004, 0.054, 0.058), (0.09, lx, 0.004, 0.04, 0.04)]
        B.loft([ring_xy(cx, cy, z, a, b, 24) for z, cx, cy, a, b in np.vstack([crom(pl[:7], 4), pl[7:]])], 'pants', wl)
        # くつ
        fb = w_rigid('foot_' + s)
        def shoe_def(L):
            L = L.copy(); t = np.clip(-L[:, 1] / 0.115, -1, 1)
            L[:, 2] = np.where(L[:, 2] > 0, L[:, 2] * (1 - 0.42 * np.clip(t + 0.25, 0, 1)), L[:, 2])   # つま先を低く
            L[:, 0] *= 1 + 0.12 * np.clip(t, 0, 1) * (1 - np.clip(t, 0, 1)) * 4 * 0.5
            return L
        ellipsoid(B, V(lx, -0.045, 0.05), V(0.054, 0.115, 0.05), 'shoe', fb, nu=22, nv=12, ev=2.6, deform=shoe_def)
        ellipsoid(B, V(lx, -0.045, 0.014), V(0.058, 0.12, 0.014), 'sole', fb, nu=22, nv=6, ev=5.0)
        ellipsoid(B, V(lx, 0.002, 0.075), V(0.05, 0.058, 0.04), 'shoe', fb, nu=16, nv=8)

    # ── 頭 ──
    hw = w_rigid('head')
    def head_def(L):
        L = L.copy(); t = np.clip(-L[:, 2] / HEAD_R[2], 0, 1); sc = 1 - 0.13 * t * t; L[:, 0] *= sc; L[:, 1] *= sc; return L
    ellipsoid(B, HEAD_C, HEAD_R, 'skin', hw, nu=44, nv=28, deform=head_def)
    ellipsoid(B, V(0, 0.032, 1.475), V(0.208, 0.2, 0.2), 'hair', hw, nu=36, nv=20)       # 後ろと横の髪
    for sg in (1, -1):
        ellipsoid(B, V(sg * 0.197, 0.012, 1.425), V(0.02, 0.034, 0.045), 'skin', hw, nu=12, nv=8)   # 耳
        # 目 (黒目 + ハイライト)
        ex, ez = sg * 0.076, 1.428
        p, n = face_pt(ex, ez, 0.002); F = face_frame(n)
        ellipsoid(B, p, V(0.021, 0.009, 0.031), 'eye', hw, R=F, nu=16, nv=10)
        p2, n2 = face_pt(ex + 0.007, ez + 0.012, 0.011)
        ellipsoid(B, p2, V(0.0065, 0.003, 0.0075), 'white', hw, R=face_frame(n2), nu=10, nv=6)
        # まゆ
        xs = np.linspace(0.04, 0.112, 9)
        tube(B, [face_pt(sg * x, 1.494 + 0.012 * sin((x - 0.04) / 0.072 * pi) - 0.004 * (x - 0.04) / 0.072, 0.004)[0] for x in xs],
             [[0.007 * (0.55 + 0.45 * sin(k / 8 * pi))] for k in range(9)], 'hair', hw, n=8, up=V(0, -1, 0))
        # めがね (丸)
        cx, cz, rr = sg * 0.079, 1.43, 0.054
        th = np.arange(28) * 2 * pi / 28; yaw = rz(sg * 0.2)
        ring = np.stack([rr * np.cos(th), np.zeros(28), rr * np.sin(th)], 1) @ yaw.T + V(cx, 0, cz)
        ymin = min(face_pt(q[0], q[2])[0][1] - (q[1]) for q in ring)
        ring[:, 1] += ymin - 0.01
        tube(B, ring, 0.0062, 'glass', hw, n=8, up=V(0, -1, 0), loop=True)
        o = ring[0 if sg > 0 else 14]   # 外側の端
        tube(B, crom([o, V(sg * 0.17, -0.11, 1.44), V(sg * 0.203, -0.02, 1.445), V(sg * 0.2, 0.03, 1.43)], 4), 0.0045, 'glass', hw, n=6)
        if sg > 0: inner_l = ring[14]
        else: inner_r = ring[0]
        # 前髪 (キャップの下から少し)
        p, n = face_pt(sg * 0.075, 1.522, 0.0)
        ellipsoid(B, p, V(0.05, 0.012, 0.024), 'hair', hw, R=face_frame(n) @ ry(sg * 0.35), nu=12, nv=8)
    mid = (inner_l + inner_r) / 2 + V(0, -0.004, 0.012)
    tube(B, crom([inner_l, mid, inner_r], 4), 0.005, 'glass', hw, n=6)
    p, n = face_pt(0, 1.526, 0.0); ellipsoid(B, p, V(0.045, 0.012, 0.022), 'hair', hw, R=face_frame(n), nu=12, nv=8)
    # 鼻・口
    p, n = face_pt(0, 1.392, 0.002); ellipsoid(B, p, V(0.015, 0.014, 0.012), 'skin', hw, nu=12, nv=8)
    xs = np.linspace(-0.038, 0.038, 13)
    tube(B, [face_pt(x, 1.343 - 0.016 * (1 - (x / 0.038) ** 2), 0.0015)[0] for x in xs],
         [[0.0052 * (0.5 + 0.5 * sin(k / 12 * pi))] for k in range(13)], 'mouth', hw, n=8, up=V(0, -1, 0))
    # ── キャップ ── (頭の中心まわりに少し後ろへ傾ける)
    cap0 = len(B.v)
    z0, H, cy = 1.53, 0.1695, 0.008
    prof = [(z0 - 0.028, 0, cy, 0.207, 0.203), (z0, 0, cy, 0.209, 0.205)] + \
           [(z0 + H * u, 0, cy, 0.209 * (1 - u * u) ** 0.46, 0.205 * (1 - u * u) ** 0.46) for u in (0.25, 0.5, 0.7, 0.85, 0.94, 0.985, 1.0)]
    B.loft([ring_xy(c1, c2, z, max(a, 1e-3), max(b, 1e-3), 40) for z, c1, c2, a, b in np.vstack([prof[:1], crom(prof[1:], 3)])], 'cap', hw)
    ellipsoid(B, V(0, cy, z0 + H), V(0.02, 0.02, 0.008), 'brim', hw, nu=12, nv=6)
    def brim_def(L):
        L = L.copy(); L[:, 2] -= 0.85 * L[:, 0] ** 2 + 0.12 * np.clip(-L[:, 1], 0, 1); return L
    ellipsoid(B, V(0, -0.225, z0 - 0.012), V(0.168, 0.13, 0.009), 'brim', hw, nu=32, nv=6, ev=3.0, deform=brim_def)
    Rt = rx(-5 * D2R); piv = V(0, 0, z0)
    for i in range(cap0, len(B.v)): B.v[i] = tuple(Rt @ (np.array(B.v[i]) - piv) + piv)
    return B

# ───────────────────────── 姿勢 (IK つき) ─────────────────────────
ARM1, ARM2 = 0.20, 0.195
LEG1, LEG2 = 0.26, 0.255

def base_pose():
    return {
        'hips': [0, 0, -0.012, 0, 0, 0], 'spine1': [0, 0, 0], 'spine2': [0, 0, 0], 'neck': [0, 0, 0], 'head': [0, 0, 0],
        'shoulder_L': [0, 0, 0], 'shoulder_R': [0, 0, 0],
        # 手首の目標 (静止姿勢の座標で書く。胸 spine2 についていく) + ひじの向き
        'arm_L': [0.232, -0.03, 0.752, 0.4, 1, 0], 'arm_R': [-0.232, -0.03, 0.752, -0.4, 1, 0],
        'hand_L': [0, 0, 0], 'hand_R': [0, 0, 0],
        # 足: 母指球の接地点 (世界座標) + つま先下げ角 + 向き
        'foot_L': [0.10, -0.10, 0, 0, 8], 'foot_R': [-0.10, -0.10, 0, 0, -8],
    }
KEYS = list(base_pose().keys())
def flat(p): return np.concatenate([np.asarray(p[k], float) for k in KEYS])
def unflat(v):
    p, i = {}, 0
    for k, b in base_pose().items(): p[k] = list(v[i:i + len(b)]); i += len(b)
    return p
def P(**kw):
    p = base_pose(); p.update(kw); return p

def eul(e): return rz(e[2] * D2R) @ rx(e[0] * D2R) @ ry(e[1] * D2R)

def two_bone(root, target, l1, l2, pole, sign):
    d = target - root; L = np.linalg.norm(d); dh = d / L; L = min(max(L, abs(l1 - l2) + 1e-4), (l1 + l2) * 0.998)
    ca = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L); sa = math.sqrt(max(0, 1 - ca * ca))
    pp = pole - pole.dot(dh) * dh; pp /= np.linalg.norm(pp)
    u1 = ca * dh + sa * pp; knee = root + l1 * u1; u2 = root + L * dh - knee; u2 /= np.linalg.norm(u2)
    n = sign * np.cross(pp, dh)
    return np.stack([n, np.cross(-u1, n), -u1], 1), np.stack([n, np.cross(-u2, n), -u2], 1)

def solve(p):
    """姿勢の指定 → 各骨の『親から見た回転 D』(静止時に世界軸と平行な軸で表す) と腰の移動。"""
    D, A, pos = {}, {}, {}
    D['hips'] = eul(p['hips'][3:]); A['hips'] = D['hips']; pos['hips'] = J['hips'] + V(*p['hips'][:3])
    def fk(b):
        par = PARENT[b]; A[b] = A[par] @ D[b]; pos[b] = pos[par] + A[par] @ (J[b] - J[par])
    for b in ('spine1', 'spine2', 'neck', 'head', 'shoulder_L', 'shoulder_R'):
        D[b] = eul(p[b]); fk(b)
    for s in 'LR':
        ua, fa, ha = 'upper_arm_' + s, 'forearm_' + s, 'hand_' + s
        root = pos['shoulder_' + s] + A['shoulder_' + s] @ (J[ua] - J['shoulder_' + s])
        tgt = pos['spine2'] + A['spine2'] @ (V(*p['arm_' + s][:3]) - J['spine2'])
        A1, A2 = two_bone(root, tgt, ARM1, ARM2, A['spine2'] @ V(*p['arm_' + s][3:]), -1)
        D[ua] = A['shoulder_' + s].T @ A1; fk(ua); D[fa] = A1.T @ A2; fk(fa); D[ha] = eul(p['hand_' + s]); fk(ha)
        th, sh, ft = 'thigh_' + s, 'shin_' + s, 'foot_' + s
        f = p['foot_' + s]; Af = rz(f[4] * D2R) @ rx(f[3] * D2R)
        ankle = V(f[0], f[1], f[2]) - Af @ BALL
        root = pos['hips'] + A['hips'] @ (J[th] - J['hips'])
        fwd = A['hips'] @ V(0, -1, 0) + Af @ V(0, -1, 0) + V(0.25 if s == 'L' else -0.25, 0, 0)
        A1, A2 = two_bone(root, ankle, LEG1, LEG2, fwd, 1)
        D[th] = A['hips'].T @ A1; fk(th); D[sh] = A1.T @ A2; fk(sh); D[ft] = A2.T @ Af; fk(ft)
    D['hand_R_attach'] = np.eye(3); fk('hand_R_attach')
    return D, V(*p['hips'][:3]), pos

def spline(keys):
    """[(時刻, 姿勢)] を Hermite でつなぐ (両端は速度 0)。"""
    T = [k[0] for k in keys]; X = [flat(k[1]) for k in keys]; n = len(T)
    M = [np.zeros_like(X[0]) if i in (0, n - 1) else (X[i + 1] - X[i - 1]) / (T[i + 1] - T[i - 1]) for i in range(n)]
    def f(t):
        t = min(max(t, T[0]), T[-1]); i = max(j for j in range(n - 1) if T[j] <= t) if t < T[-1] else n - 2
        h = T[i + 1] - T[i]; u = (t - T[i]) / h
        return unflat((2 * u ** 3 - 3 * u * u + 1) * X[i] + (u ** 3 - 2 * u * u + u) * h * M[i] + (-2 * u ** 3 + 3 * u * u) * X[i + 1] + (u ** 3 - u * u) * h * M[i + 1])
    return f

# ───────────────────────── クリップ ─────────────────────────
def breathe(p, t, k=1.0):
    """2 秒周期の呼吸と重心移動を姿勢に足す。"""
    w = pi * t; sh, br = sin(w) * k, sin(w - 0.9)
    h = p['hips']; p['hips'] = [h[0] + 0.011 * sh, h[1], h[2] - 0.004 * br, h[3], h[4] - 0.8 * sh, h[5] + 0.6 * sh]
    a = p['spine1']; p['spine1'] = [a[0] + 0.5 * br, a[1] + 1.2 * sh, a[2]]
    a = p['spine2']; p['spine2'] = [a[0] - 1.6 * br, a[1] + 0.5 * sh, a[2] - 0.8 * sh]
    a = p['head']; p['head'] = [a[0] + 1.2 * br, a[1] - 0.8 * sh, a[2] + 1.5 * sin(w + 0.7) * k]
    a = p['shoulder_L']; p['shoulder_L'] = [a[0], a[1] - 2.2 * br, a[2]]
    a = p['shoulder_R']; p['shoulder_R'] = [a[0], a[1] + 2.2 * br, a[2]]
    return p

def c_idle(t):
    p = breathe(base_pose(), t)
    for s, sg in (('L', 1), ('R', -1)):
        a = p['arm_' + s]; a[1] += 0.008 * sin(pi * t + 0.5 * sg); a[0] += sg * 0.004 * sin(pi * t - 0.9)
    return p

HOLD = dict(arm_R=[-0.10, -0.25, 1.01, -1, 0.5, -0.7], hand_R=[-35, 0, 20], head=[3, 0, 0])
def c_hold(t): return breathe(P(**HOLD), t, 0.5)

RELEASE_FRAME = 22
def make_throw():
    K = [
        (0, c_hold(0)),
        (6, P(hips=[0, 0.02, -0.03, 0, 0, -12], spine1=[2, 0, -8], spine2=[0, 0, -8], head=[0, 0, 22],
              arm_R=[-0.22, -0.18, 1.12, -1, 0.5, -0.7], hand_R=[-25, 0, 10], arm_L=[0.22, -0.14, 0.86, 0.4, 1, 0],
              foot_L=[0.10, -0.11, 0.01, 8, 8], foot_R=[-0.10, -0.10, 0, 0, -14])),
        (13, P(hips=[-0.03, 0.05, -0.035, -4, 0, -32], spine1=[-3, 0, -14], spine2=[-4, 0, -16], neck=[0, 0, 12], head=[2, 0, 42],
               arm_R=[-0.37, 0.10, 1.37, -1, 0.5, -0.8], hand_R=[20, 0, 0], arm_L=[0.34, -0.2, 1.12, 0.5, 0.5, -1],
               foot_L=[0.10, -0.24, 0.085, 12, 5], foot_R=[-0.10, -0.10, 0, 0, -26])),
        (18, P(hips=[0.0, -0.09, -0.055, 2, 0, -8], spine1=[0, 0, -10], spine2=[-3, 0, -14], neck=[0, 0, 6], head=[0, 0, 22],
               arm_R=[-0.35, 0.15, 1.41, -1, 0.3, -0.6], hand_R=[25, 0, 0], arm_L=[0.27, -0.2, 1.0, 0.6, 0.6, -0.6],
               foot_L=[0.10, -0.41, 0, -4, 5], foot_R=[-0.10, -0.10, 0, 16, -20])),
        (RELEASE_FRAME, P(hips=[0.02, -0.16, -0.05, 6, 0, 10], spine1=[8, 0, 6], spine2=[8, 0, 8], head=[-10, 0, -20],
               arm_R=[-0.34, -0.36, 1.43, -1, 0, -0.5], hand_R=[-10, 0, 0], arm_L=[0.23, 0.0, 0.95, 1, 1, 0],
               foot_L=[0.10, -0.41, 0, 0, 5], foot_R=[-0.10, -0.10, 0, 40, -12])),
        (27, P(hips=[0.03, -0.20, -0.065, 10, 0, 30], spine1=[9, 0, 12], spine2=[8, 0, 14], head=[-16, 0, -42],
               arm_R=[0.08, -0.30, 0.86, -1, 0.5, 0], hand_R=[-20, 0, 0], arm_L=[0.27, 0.12, 0.9, 1, 1, 0],
               foot_L=[0.10, -0.41, 0, 0, 5], foot_R=[-0.10, -0.13, 0, 52, -8])),
        (36, P(hips=[0.02, -0.18, -0.035, 4, 0, 12], spine1=[4, 0, 4], spine2=[3, 0, 4], head=[-5, 0, -14],
               arm_R=[-0.17, -0.15, 0.80, -0.4, 1, 0], arm_L=[0.25, 0.02, 0.77, 0.4, 1, 0],
               foot_L=[0.10, -0.41, 0, 0, 5], foot_R=[-0.10, -0.12, 0, 28, -8])),
    ]
    return spline([(f / FPS, p) for f, p in K])
c_throw = make_throw()

def c_shake(t):
    a = sm(t / 0.28)
    env = sm((t - 0.18) / 0.12) * (1 - sm((t - 0.9) / 0.25))
    yaw = 27 * sin(2 * pi * (t - 0.18) / 0.4) * env
    L = lambda u, v: [x + (y - x) * a for x, y in zip(u, v)]
    b = base_pose()
    return P(hips=[0, 0, -0.012 - 0.008 * a, 0, 0, -0.12 * yaw],
             spine1=[2 * a, 0, -0.1 * yaw], spine2=[3 * a, 0, -0.12 * yaw], neck=[2 * a, 0, 0.25 * yaw], head=[7 * a, 2.5 * a, 0.75 * yaw],
             shoulder_L=[0, -7 * a, 0], shoulder_R=[0, 7 * a, 0],
             arm_L=L(b['arm_L'], [0.245, 0.0, 0.875, 1, 0.55, 0.1]), arm_R=L(b['arm_R'], [-0.245, 0.0, 0.875, -1, 0.55, 0.1]),
             hand_L=L([0, 0, 0], [0, 28, 0]), hand_R=L([0, 0, 0], [0, -28, 0]))

_UP = dict(hips=[0, 0.012, -0.012, -2, 0, 0], spine1=[-3, 0, 0], spine2=[-6, 0, 0], neck=[-9, 0, 0], head=[-17, 0, 0],
           shoulder_L=[0, 3, 0], shoulder_R=[0, -3, 0], arm_L=[0.25, 0.045, 0.775, 0.4, 1, 0], arm_R=[-0.25, 0.045, 0.775, -0.4, 1, 0],
           hand_L=[0, -12, 0], hand_R=[0, 12, 0])
_UP2 = dict(_UP, hips=[0, 0.016, -0.004, -3, 0, 0], neck=[-11, 0, 0], head=[-21, 0, 0])
c_look = spline([
    (0, base_pose()),
    (0.16, P(hips=[0, -0.005, -0.03, 2, 0, 0], spine2=[3, 0, 0], head=[6, 0, 0])),
    (0.55, P(**_UP2)), (0.8, P(**_UP)), (1.0, P(**_UP)),
])

def c_wave(t):
    w = 2 * pi * t / 1.6; s2 = sin(2 * w); s1 = sin(w)
    return P(hips=[0.008 + 0.006 * s1, 0, -0.012 - 0.003 * cos(2 * w), 0, -1.5 + 0.5 * s1, 2],
             spine1=[0, 2.5, 0], spine2=[-1, 2 + 1.0 * s2, 1], head=[-2, -4 + 1.5 * s2, 3 * s1], neck=[0, -1, 0],
             shoulder_R=[0, 12, 0],
             arm_R=[-0.40 - 0.085 * s2, -0.06, 1.47 - 0.02 * cos(2 * w), -1, 0.15, -0.9], hand_R=[0, -14 * sin(2 * w - 0.6), 0],
             arm_L=[0.243, -0.015 + 0.006 * s2, 0.757, 0.4, 1, 0])

def c_walk(t):
    ph = 2 * pi * t; S = 0.13
    def foot(sg, f):
        swing = max(0.0, sin(f)); pitch = 20 * cos(f) - 6 * swing
        return [sg * 0.092, -0.09 + S * cos(f), 0.065 * swing ** 1.2 + max(0.0, -pitch) * 0.0017, pitch, sg * 6]
    c, s_ = cos(ph), sin(ph)
    return P(hips=[-0.014 * s_, 0, -0.028 - 0.011 * cos(2 * ph), 2, 1.5 * s_, 6 * c],
             spine1=[1, -1.5 * s_, -5 * c], spine2=[1, -1 * s_, -7 * c], neck=[0, 0, 3 * c], head=[-1 + 1 * cos(2 * ph), 0, 3 * c],
             foot_L=foot(1, ph), foot_R=foot(-1, ph + pi),
             arm_L=[0.235, -0.02 - 0.12 * c, 0.775 + 0.035 * c * c + 0.02 * max(0, c), 0.4, 1, 0],
             arm_R=[-0.235, -0.02 + 0.12 * c, 0.775 + 0.035 * c * c + 0.02 * max(0, -c), -0.4, 1, 0],
             hand_L=[-8 * max(0, c), 0, 0], hand_R=[-8 * max(0, -c), 0, 0])

CLIPS = [  # name, 関数, 長さ(秒), ループ
    ('idle', c_idle, 2.0, True), ('hold', c_hold, 2.0, True), ('throw', c_throw, 1.2, False),
    ('shake_head', c_shake, 1.2, False), ('look_up', c_look, 1.0, False), ('wave', c_wave, 1.6, True), ('walk', c_walk, 1.0, True),
]

# ───────────────────────── Blender ─────────────────────────
def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]

def make_mat(name, hexc, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = srgb(hexc); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0.0
    return m

def to_b64js(path, key):
    with open(path, 'rb') as f: b = base64.b64encode(f.read()).decode()
    with open(path + '.js', 'w') as f:
        f.write('(window.AUTO_ASSET_DATA=window.AUTO_ASSET_DATA||{})[%s]="%s";\n' % (json.dumps(key), b))

def export(path, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                              export_animations=len(objs) > 1, export_animation_mode='ACTIONS', export_force_sampling=True,
                              export_optimize_animation_size=False, export_skins=True, export_extras=True,
                              export_texcoords=False, export_tangents=False, export_cameras=False, export_lights=False)

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.fps = FPS; sc.frame_start = 0
    mats = {k: make_mat('keisan_' + k, h, r) for k, (h, r) in MATS.items()}

    # 骨: すべて真上向き・roll 0 → glTF では静止時の回転がすべて単位になる
    ad = bpy.data.armatures.new('keisan_rig'); arm = bpy.data.objects.new('keisan', ad); sc.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
    for b in BONES:
        eb = ad.edit_bones.new(b); eb.head = Vector(J[b]); eb.tail = Vector(J[b] + V(0, 0, 0.04)); eb.roll = 0
        if PARENT[b]: eb.parent = ad.edit_bones[PARENT[b]]
        eb.use_connect = False; eb.use_deform = b != 'hand_R_attach'
    bpy.ops.object.mode_set(mode='OBJECT')

    B = build_mesh()
    zs = [v[2] for v in B.v]; print('mesh z range', min(zs), max(zs), 'verts', len(B.v), 'faces', len(B.f))
    me = bpy.data.meshes.new('keisan_mesh'); me.from_pydata(B.v, [], B.f)
    for k in MATS: me.materials.append(mats[k])
    me.polygons.foreach_set('material_index', B.m)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
    ob = bpy.data.objects.new('keisan_body', me); sc.collection.objects.link(ob); ob.parent = arm
    md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    vg = {b: ob.vertex_groups.new(name=b) for b in BONES if b != 'hand_R_attach'}
    for i, w in enumerate(B.w):
        w = {k: x for k, x in w.items() if x > 0.004}; t = sum(w.values())
        for k, x in w.items(): vg[k].add([i], x / t, 'REPLACE')

    # アニメーション
    Rb = {b: np.array(ad.bones[b].matrix_local.to_3x3()) for b in BONES}
    arm.animation_data_create(); meta = {'fps': FPS, 'clips': {}, 'height': 1.7}
    for name, fn, dur, loop in CLIPS:
        act = bpy.data.actions.new(name); arm.animation_data.action = act; prev = {}
        nf = int(round(dur * FPS))
        for f in range(nf + 1):
            D, t, pos = solve(fn((0 if loop and f == nf else f) / FPS))
            for b in BONES:
                if b == 'hand_R_attach': continue
                pb = arm.pose.bones[b]; q = Matrix(Rb[b].T @ D[b] @ Rb[b]).to_quaternion()
                if b in prev and prev[b].dot(q) < 0: q.negate()
                prev[b] = q.copy(); pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=f)
            pb = arm.pose.bones['hips']; pb.location = Vector(Rb['hips'].T @ t); pb.keyframe_insert('location', frame=f)
            if name == 'throw' and f == RELEASE_FRAME:
                g = lambda v: [round(float(v[0]), 4), round(float(v[2]), 4), round(float(-v[1]), 4)]
                meta['throw_release_time'] = round(f / FPS, 4); meta['throw_release_hand_pos'] = g(pos['hand_R_attach'])
        meta['clips'][name] = {'duration': dur, 'loop': loop}
        act.use_fake_user = True
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    arm['throw_release_time'] = meta['throw_release_time']
    arm['clips'] = json.dumps(meta['clips'])

    os.makedirs(OUT, exist_ok=True)
    glb = os.path.join(OUT, 'keisan.glb'); export(glb, [arm, ob]); to_b64js(glb, 'keisan.glb')
    with open(os.path.join(OUT, 'keisan.meta.json'), 'w') as f: json.dump(meta, f, indent=1)
    with open(glb + '.js', 'a') as f: f.write('window.AUTO_ASSET_DATA["keisan.meta"]=%s;\n' % json.dumps(meta))

    # 紙飛行機 (機首 -y = glTF の +Z、長さ 1)
    N, T, K = (0, -0.5, 0), (0, 0.5, 0), (0, 0.5, -0.13)
    pv, pf = [N, K], []
    for sg in (1, -1):
        i = len(pv); pv += [(sg * 0.012, 0.5, 0.0), (sg * 0.15, 0.5, 0.05), (sg * 0.33, 0.5, 0.02), (sg * 0.012, 0.2, -0.04)]
        pf += [(0, 1, i), (0, i, i + 1), (0, i + 1, i + 2)]
    pm = bpy.data.meshes.new('paper_plane'); pm.from_pydata(pv, [], pf); pm.update()
    m = make_mat('paper', '#fbfbf6', 0.9); m.use_backface_culling = False; pm.materials.append(m)
    po = bpy.data.objects.new('paper_plane', pm); sc.collection.objects.link(po)
    pglb = os.path.join(OUT, 'paper_plane.glb'); export(pglb, [po]); to_b64js(pglb, 'paper_plane.glb')
    print('done', meta)

if __name__ == '__main__':
    main()
