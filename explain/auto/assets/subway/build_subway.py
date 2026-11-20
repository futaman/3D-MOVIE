"""地下鉄の工事の構造物アセットを Blender (bpy) で作る。乱数なし。

    .venv/bin/python build_subway.py      # bpy 5.x。出力はこのフォルダ

作るもの(1 = 1 m、glTF の +Y が上):
  shield_machine  泥土圧式シールドマシン(外径 7.0 m、長さ 9 m)。掘る向きは glTF の +X、原点はカッターの面の中心
                  ノード: cutter(x 軸で回す)、body、jacks
  segment_ring    セグメントの 1 リング(外径 6.8 m、内径 6.2 m、幅 1.2 m、A 5 枚 + K 1 枚)。軸は x、原点はリングの中心
                  ノード: seg_0..5(エレクターで 1 枚ずつ置ける)
  escalator       エスカレーター 1 区間(高さ 10 m、30 度)。下の乗り口が原点、上る向きが +X
一般的な形で、特定の工事・駅の物ではない。柱・梁・機械の構造物なのでスクリプトで組む(skill のアセット方針)。
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hamanako_props"))
import build_props as B          # mat / tube / box / sweep / empty / export / write_js / reset を使い回す
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
B.HERE = HERE
# Blender の座標: x = 掘る向き(glTF +X)、z = 上(glTF +Y)、y = 横(glTF -Z)

def ring_mesh(name, r_out, r_in, x0, x1, a0, a1, m, parent, segs=48, bevel=0.0):
    """x 軸まわりの扇形の厚い輪(角度 a0..a1)。"""
    n = max(2, int(segs * (a1 - a0) / (2 * math.pi)) + 1); verts, faces = [], []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        for (r, x) in ((r_out, x0), (r_out, x1), (r_in, x1), (r_in, x0)):
            verts.append((x, r * math.cos(a), r * math.sin(a)))
    for i in range(n):
        b, c = i * 4, (i + 1) * 4
        for j in range(4):
            jj = (j + 1) % 4; faces.append((b + j, c + j, c + jj, b + jj))
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    if not full: faces.append((0, 1, 2, 3)[::-1]); faces.append((n * 4, n * 4 + 1, n * 4 + 2, n * 4 + 3))
    return B.mesh_from(name, verts, faces, m, bevel, True, parent)

def build_shield():
    B.reset(); root = B.empty('shield_machine')
    SKIN, DARK, BIT, JACK, CUT = B.mat('skin', '#e0a21b', 0.45, 0.5), B.mat('dark_steel', '#3b4047', 0.45, 0.8), B.mat('bit', '#c9ccd0', 0.25, 0.9), B.mat('jack', '#d5d8dc', 0.2, 0.9), B.mat('cutter', '#2f6fb3', 0.4, 0.5)
    R, L = 3.5, 9.0
    body = B.empty('body', parent=root)
    ring_mesh('skin', R, R - 0.12, -L, -0.6, 0, 2 * math.pi, SKIN, body, segs=96, bevel=0.01)
    ring_mesh('bulkhead', R - 0.12, 0.6, -1.5, -1.3, 0, 2 * math.pi, DARK, body, segs=96)
    ring_mesh('tail_seal', R - 0.05, R - 0.25, -L - 0.02, -L + 0.3, 0, 2 * math.pi, DARK, body, segs=96)
    for k in range(3):   # 外板の継ぎ目の帯
        ring_mesh('band', R + 0.03, R - 0.05, -2.6 - k * 2.4, -2.45 - k * 2.4, 0, 2 * math.pi, DARK, body, segs=96)
    # スクリューコンベヤ(土を後ろへ送る斜めの管)
    B.tube('screw', (-1.5, 0, -2.2), (-L + 0.5, 0, 0.4), 0.45, DARK, segs=24, parent=body)
    # エレクター(セグメントを持ち上げる腕)
    B.tube('erector_ring', (-L + 1.6, 0, 0), (-L + 2.0, 0, 0), 2.6, DARK, segs=48, parent=body)
    B.box('erector_arm', (0.5, 0.6, 2.4), (-L + 1.4, 0, 1.6), B.mat('erector', '#c23b2a', 0.45, 0.5), bevel=0.05, parent=body)
    # ジャッキ(セグメントを押して前に進む)。後ろ向き。jacks ノードは伸び縮みに使える
    jacks = B.empty('jacks', loc=(-L + 2.6, 0, 0), parent=root)
    for i in range(16):
        a = 2 * math.pi * (i + 0.5) / 16; y, z = (R - 0.45) * math.cos(a), (R - 0.45) * math.sin(a)
        B.tube('jack_body', (0, y, z), (-1.0, y, z), 0.16, DARK, segs=14, parent=jacks)
        B.tube('jack_rod', (-1.0, y, z), (-2.4, y, z), 0.09, JACK, segs=12, parent=jacks)
        B.box('jack_shoe', (0.12, 0.45, 0.3), (-2.42, y, z), DARK, bevel=0.02, parent=jacks)
    # カッター(前面の円板とスポーク、ビット)
    cut = B.empty('cutter', parent=root)
    B.tube('cutter_hub', (-0.6, 0, 0), (0.05, 0, 0), 0.9, CUT, segs=40, parent=cut, bevel=0.03)
    ring_mesh('cutter_rim', R - 0.02, R - 0.42, -0.55, 0.0, 0, 2 * math.pi, CUT, cut, segs=96, bevel=0.02)
    for i in range(6):
        a = 2 * math.pi * i / 6
        p = lambda r, x=0.0: (x, r * math.cos(a), r * math.sin(a))
        rm = (0.9 + R - 0.3) / 2
        B.box('spoke', (0.5, R - 1.2, 0.5), (-0.25, rm * math.cos(a), rm * math.sin(a)), CUT, bevel=0.04, parent=cut).rotation_euler = (a, 0, 0)
        for k in range(7):
            r = 1.1 + k * 0.33
            for s in (-1, 1):
                q = Vector(p(r, 0.08)) + Vector((0, -math.sin(a), math.cos(a))) * (s * 0.17)
                B.box('bit', (0.18, 0.1, 0.14), tuple(q), BIT, bevel=0.015, parent=cut).rotation_euler = (a, 0, 0)
    for i in range(6):   # スポークの間の開口のふち
        a = 2 * math.pi * (i + 0.5) / 6
        B.tube('disc_cutter', (0.0, 2.2 * math.cos(a), 2.2 * math.sin(a)), (0.12, 2.2 * math.cos(a), 2.2 * math.sin(a)), 0.22, BIT, segs=20, parent=cut)
    B.export(os.path.join(HERE, 'shield_machine.glb'), root)
    B.write_js('shield_machine', {"name": "泥土圧式シールドマシン(一般的な形)", "outer_diameter_m": 2 * R, "length_m": L, "axis": "掘る向き = +X(glTF)。原点はカッターの面の中心",
                                   "nodes": "cutter(x 軸で回す)、body、jacks(後ろ向きのジャッキ)", "tail_x_m": -L})

def build_ring():
    B.reset(); root = B.empty('segment_ring')
    CON, CON2, BOLT = B.mat('segment', '#b9b6ad', 0.85), B.mat('segment_k', '#aaa79f', 0.85), B.mat('bolt_pocket', '#55534e', 0.9)
    RO, RI, W, gap = 3.4, 3.1, 1.2, 0.012
    # A 5 枚(各 66°)+ K 1 枚(30°)
    spans = [66] * 5 + [30]; a = math.radians(-90 + 15)
    for i, deg in enumerate(spans):
        a0, a1 = a + gap, a + math.radians(deg) - gap; a = a + math.radians(deg)
        seg = B.empty('seg_%d' % i, parent=root)
        ring_mesh('segment', RO, RI, -W / 2 + gap, W / 2 - gap, a0, a1, CON2 if deg == 30 else CON, seg, segs=96, bevel=0.012)
        for k in range(2):   # 内側のボルト穴(くぼみ)
            am = a0 + (a1 - a0) * (0.25 + 0.5 * k)
            for xx in (-0.42, 0.42):
                B.box('pocket', (0.18, 0.16, 0.05), (xx, (RI - 0.01) * math.cos(am), (RI - 0.01) * math.sin(am)), BOLT, bevel=0.0, parent=seg).rotation_euler = (am - math.pi / 2, 0, 0)
    B.export(os.path.join(HERE, 'segment_ring.glb'), root)
    B.write_js('segment_ring', {"name": "RC セグメント 1 リング(一般的な寸法)", "outer_diameter_m": 2 * RO, "inner_diameter_m": 2 * RI, "width_m": W, "pieces": "seg_0..4 = A(66°)、seg_5 = K(30°、最後に入れるくさび)", "axis": "x"})

def build_escalator():
    B.reset(); root = B.empty('escalator')
    TRUSS, STEP, GLASS, RAIL, ALU = B.mat('truss', '#8e949b', 0.45, 0.6), B.mat('step', '#3a3d42', 0.5, 0.6), B.mat('balustrade', '#c9dbe3', 0.05, 0.0, alpha=0.3), B.mat('handrail', '#111214', 0.4), B.mat('aluminium', '#c7cbd0', 0.3, 0.8)
    RISE, ANG, WID = 10.0, math.radians(30), 1.0
    run = RISE / math.tan(ANG); L = math.hypot(run, RISE); FL = 2.4   # 上下の平らな部分
    # 外装(斜めの箱) — 下の乗り口 (0,0,0) から上り口 (FL+run+FL, 0, RISE)
    def slab(name, x0, z0, x1, z1, half_w, top, bottom, m):
        v = [(x0, -half_w, z0 + bottom), (x1, -half_w, z1 + bottom), (x1, half_w, z1 + bottom), (x0, half_w, z0 + bottom),
             (x0, -half_w, z0 + top), (x1, -half_w, z1 + top), (x1, half_w, z1 + top), (x0, half_w, z0 + top)]
        f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        return B.mesh_from(name, v, f, m, 0.02, False, root)
    pts = [(-FL, 0), (0, 0), (run, RISE), (run + FL, RISE)]
    for (x0, z0), (x1, z1) in zip(pts[:-1], pts[1:]):
        slab('truss', x0, z0, x1, z1, WID / 2 + 0.45, -0.05, -1.2, TRUSS)
        for s in (-1, 1):
            slab('skirt', x0, z0, x1, z1, 0.06, 0.18, -0.05, ALU).location = (0, s * (WID / 2 + 0.06), 0)
            slab('glass', x0, z0, x1, z1, 0.015, 1.0, 0.18, GLASS).location = (0, s * (WID / 2 + 0.12), 0)
    # 段
    n = int(L / 0.4)
    for i in range(n):
        x = 0.2 + i * run / n; z = i * RISE / n
        B.box('step', (run / n - 0.02, WID, 0.12), (x + run / n / 2, 0, z + 0.06), STEP, bevel=0.01, parent=root)
    # 手すり(ゴム)
    for s in (-1, 1):
        y = s * (WID / 2 + 0.12)
        B.sweep('handrail', [(-FL, y, 1.05), (0, y, 1.05), (run, y, RISE + 1.05), (run + FL, y, RISE + 1.05)], [(-0.04, -0.03), (0.04, -0.03), (0.04, 0.03), (-0.04, 0.03)], RAIL, parent=root)
    B.export(os.path.join(HERE, 'escalator.glb'), root)
    B.write_js('escalator', {"name": "エスカレーター 1 区間(一般的な形)", "rise_m": RISE, "angle_deg": 30, "run_m": round(run, 3), "landing_m": FL,
                              "axis": "上る向き = +X(glTF)。原点は下の乗り口の床。上の乗り口は (run, rise, 0)"})

if __name__ == '__main__':
    build_shield(); build_ring(); build_escalator()
    for f in ('shield_machine', 'segment_ring', 'escalator'):
        print(f, os.path.getsize(os.path.join(HERE, f + '.glb')) // 1024, 'KB')
