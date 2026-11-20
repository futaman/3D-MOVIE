"""ロープ式エレベーターの断面アセットを Blender (bpy) で作る。乱数なし。

    .venv/bin/python build_elevator.py      # bpy 5.x。出力はこのフォルダ

1 = 1 m。glTF の +Y が上、+Z が手前(昇降路の手前の壁は取り払った断面)。
ノード:
  shaft      固定物: 壁(奥・左右)、各階の床の縁、かご用と釣合おもり用のガイドレール、巻上機と綱車、調速機、
             ピットの張り車、緩衝器。綱車 sheave と調速機の車 gov_sheave は回せる(z 軸)
  car        かご(原点はかごの床の中心)。前面は開いた断面。子に wedge_l / wedge_r(非常止めのくさび)
  cwt        釣合おもり(原点は中心)
ロープ(主索 4 本・調速機ロープ)は位置が動くので、JS で meta の点を結んで描く。
一般的な形で、特定の製品ではない(skill のアセット方針: 機械・構造物はスクリプトで組んでよい)。
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hamanako_props"))
import build_props as B

HERE = os.path.dirname(os.path.abspath(__file__)); B.HERE = HERE
# Blender の座標: x = 横、-y = 手前(glTF +Z)、z = 上(glTF +Y)。以下 Y_ は Blender の y(手前が負)
FLOOR_H, NFLOOR, PIT = 3.5, 6, 1.6
TOP = FLOOR_H * (NFLOOR - 1) + 4.2          # 最上階の床からさらに上の機械の高さ
XL, XR, YB = -1.35, 2.45, 1.05             # 昇降路の左右の壁(内側)と奥の壁(内側)
CAR_W, CAR_D, CAR_H = 1.7, 1.5, 2.35
RAIL_X = 1.0                               # かご用レールの x(±)
CW_X, CW_W = 1.75, 0.62                    # 釣合おもりの中心と幅
SHEAVE = (0.875, TOP + 0.9, 0.875)         # 綱車の中心 x, z と半径(左の接線がかご、右が釣合おもり)
GOV = (-1.05, TOP + 0.6, 0.25)             # 調速機の車

def build():
    B.reset(); root = B.empty('elevator')
    CON, CON2 = B.mat('concrete', '#a8a49c', 0.92), B.mat('slab', '#8f8b84', 0.9)
    RAIL, STEEL, SS = B.mat('rail', '#3d4249', 0.45, 0.8), B.mat('sling', '#2f4f7a', 0.45, 0.5), B.mat('stainless', '#c9ccd0', 0.28, 0.9)
    FLR, MOT, GOVM = B.mat('car_floor', '#55585e', 0.7), B.mat('motor', '#3e6b4f', 0.45, 0.4), B.mat('governor', '#c23b2a', 0.4, 0.4)
    CWM, SPR, OIL = B.mat('cwt', '#6a7480', 0.5, 0.6), B.mat('spring', '#e0b42a', 0.4, 0.6), B.mat('dark', '#1e2125', 0.5, 0.6)
    shaft = B.empty('shaft', parent=root)
    H = TOP + 2.2
    # 壁(奥、左、右)と底
    B.box('wall_back', (XR - XL + 0.6, 0.3, H + PIT), ((XL + XR) / 2, YB + 0.15, (H - PIT) / 2), CON, bevel=0.0, parent=shaft)
    B.box('wall_l', (0.3, YB + 1.2, H + PIT), (XL - 0.15, (YB - 1.2) / 2, (H - PIT) / 2), CON, bevel=0.0, parent=shaft)
    B.box('wall_r', (0.3, YB + 1.2, H + PIT), (XR + 0.15, (YB - 1.2) / 2, (H - PIT) / 2), CON, bevel=0.0, parent=shaft)
    B.box('pit', (XR - XL + 0.6, YB + 1.2, 0.4), ((XL + XR) / 2, (YB - 1.2) / 2, -PIT - 0.2), CON2, bevel=0.0, parent=shaft)
    B.box('machine_floor', (XR - XL + 0.6, YB - 0.3, 0.35), ((XL + XR) / 2, (YB + 0.3) / 2, TOP + 0.1), CON2, bevel=0.0, parent=shaft)   # 主索が通る手前側は開けておく
    for i in range(NFLOOR):   # 各階の床の縁(左右の壁から少し出る)
        z = i * FLOOR_H
        for x0, x1 in ((XL - 0.3, XL + 0.05), (XR - 0.05, XR + 0.3)):
            B.box('floor_edge', (x1 - x0, YB + 1.2, 0.3), ((x0 + x1) / 2, (YB - 1.2) / 2, z - 0.15), CON2, bevel=0.01, parent=shaft)
        B.box('sill', (1.1, 0.12, 0.06), (0, YB - 0.05, z + 0.03), SS, bevel=0.005, parent=shaft)
        B.box('door', (1.0, 0.06, 2.1), (0, YB - 0.02, z + 1.08), B.mat('landing_door', '#b8bcc1', 0.35, 0.8), bevel=0.01, parent=shaft)
    # ガイドレール(T 形)
    def t_rail(x, inward, z0, z1, name):
        B.box(name + '_blade', (0.016, 0.07, z1 - z0), (x - inward * 0.035, 0, (z0 + z1) / 2), RAIL, bevel=0.002, parent=shaft)
        B.box(name + '_base', (0.012, 0.13, z1 - z0), (x, 0, (z0 + z1) / 2), RAIL, bevel=0.002, parent=shaft)
    for s in (-1, 1): t_rail(s * RAIL_X, s, -PIT, TOP, 'rail_car')
    for xr, inw in ((CW_X - CW_W / 2 - 0.08, -1), (CW_X + CW_W / 2 + 0.08, 1)): t_rail(xr, inw, -PIT, TOP, 'rail_cw')
    # 巻上機: 綱車(回る)とモーター
    sx, sz, sr = SHEAVE
    sh = B.empty('sheave', loc=(sx, 0, sz), parent=shaft)
    B.tube('sheave_disc', (0, -0.18, 0), (0, 0.18, 0), sr, B.mat('sheave', '#4a4f56', 0.35, 0.8), segs=64, parent=sh, bevel=0.01)
    for k in range(4): B.tube('groove', (0, -0.12 + k * 0.08, 0), (0, -0.1 + k * 0.08, 0), sr + 0.01, OIL, segs=64, parent=sh)
    for k in range(6):
        a = k * math.pi / 3; B.box('spoke_mark', (sr * 1.6, 0.02, 0.08), (0, -0.19, 0), B.mat('mark', '#d8d8d0', 0.5), bevel=0.0, parent=sh).rotation_euler = (0, a, 0)
    B.tube('motor', (sx, 0.2, sz), (sx, 1.0, sz), 0.45, MOT, segs=40, parent=shaft, bevel=0.02)
    B.box('machine_base', (2.2, 0.8, 0.5), (sx, 0.7, TOP + 0.5), STEEL, bevel=0.03, parent=shaft)
    # 調速機(上)と張り車(ピット)
    gx, gz, gr = GOV
    gs = B.empty('gov_sheave', loc=(gx, 0, gz), parent=shaft)
    B.tube('gov_disc', (0, -0.06, 0), (0, 0.06, 0), gr, GOVM, segs=48, parent=gs, bevel=0.005)
    for k in range(3):
        a = k * 2 * math.pi / 3; B.box('flyweight', (0.12, 0.05, 0.05), (0.13 * math.cos(a), -0.09, 0.13 * math.sin(a)), OIL, bevel=0.005, parent=gs)
    B.box('gov_body', (0.7, 0.4, 0.4), (gx, 0.2, gz - 0.4), GOVM, bevel=0.03, parent=shaft)
    B.tube('tension_pulley', (gx, -0.05, -PIT + 0.55), (gx, 0.05, -PIT + 0.55), gr, GOVM, segs=40, parent=shaft)
    B.box('tension_weight', (0.25, 0.2, 0.5), (gx, 0, -PIT + 0.2), OIL, bevel=0.02, parent=shaft)
    # 緩衝器(かごの下に 2 つ、釣合おもりの下に 1 つ)。ばね
    def spring(x, h, r, name):
        n, turns, pts = 160, 9, []
        for i in range(n + 1):
            t = i / n; a = t * turns * 2 * math.pi; pts.append((x + r * math.cos(a), r * math.sin(a), -PIT + 0.1 + h * t))
        B.sweep(name, pts, [(0.025 * math.cos(q), 0.025 * math.sin(q)) for q in [i * math.pi / 4 for i in range(8)]], SPR, parent=shaft)
        B.box(name + '_seat', (2.4 * r, 2.4 * r, 0.06), (x, 0, -PIT + 0.06), OIL, bevel=0.005, parent=shaft)
        B.box(name + '_cap', (2.4 * r, 2.4 * r, 0.06), (x, 0, -PIT + 0.12 + h), OIL, bevel=0.005, parent=shaft)
    for x in (-0.45, 0.45): spring(x, 0.75, 0.13, 'buffer_car')
    spring(CW_X, 0.6, 0.12, 'buffer_cw')

    # ---- かご(原点は床の中心) ----
    car = B.empty('car', parent=root)
    w, d, h = CAR_W, CAR_D, CAR_H
    B.box('car_floor', (w, d, 0.12), (0, 0, -0.06), FLR, bevel=0.01, parent=car)
    B.box('car_roof', (w, d, 0.08), (0, 0, h + 0.04), SS, bevel=0.01, parent=car)
    B.box('car_back', (w, 0.04, h), (0, d / 2 - 0.02, h / 2), SS, bevel=0.005, parent=car)
    for s in (-1, 1): B.box('car_side', (0.04, d, h), (s * (w / 2 - 0.02), 0, h / 2), SS, bevel=0.005, parent=car)
    B.box('handrail', (1.2, 0.04, 0.04), (0, d / 2 - 0.08, 0.9), B.mat('rail_bar', '#e5e5e0', 0.3, 0.8), bevel=0.01, parent=car)
    B.box('light', (1.0, 0.6, 0.03), (0, 0, h - 0.02), B.mat('car_light', '#fff8e8', 0.2), bevel=0.01, parent=car)
    # かご枠(縦枠・上枠・下枠)
    for s in (-1, 1): B.box('stile', (0.1, 0.16, h + 0.9), (s * (RAIL_X - 0.12), 0, (h + 0.6) / 2 - 0.15), STEEL, bevel=0.01, parent=car)
    B.box('crosshead', (2 * RAIL_X - 0.14, 0.2, 0.22), (0, 0, h + 0.62), STEEL, bevel=0.01, parent=car)
    B.box('plank', (2 * RAIL_X - 0.14, 0.24, 0.2), (0, 0, -0.25), STEEL, bevel=0.01, parent=car)
    B.box('rope_hitch', (0.5, 0.16, 0.12), (0, 0, h + 0.79), OIL, bevel=0.01, parent=car)
    # 非常止め装置(下枠の両端、レールの左右に箱。くさびが上がってレールを挟む)
    for s, nm in ((-1, 'l'), (1, 'r')):
        B.box('safety_block_' + nm, (0.16, 0.26, 0.3), (s * (RAIL_X - 0.04), 0, -0.25), OIL, bevel=0.01, parent=car)
        # くさびはレールの刃(x = ±(RAIL_X - 0.035)、x 方向に薄い)を左右から挟む位置。wedge_* の子 wedge_in / wedge_out
        wg = B.empty('wedge_' + nm, loc=(s * (RAIL_X - 0.035), 0, -0.3), parent=car)
        for side, nn in ((-1, 'a'), (1, 'b')):
            w = B.empty('wedge_' + nm + '_' + nn, loc=(side * 0.045, 0, 0), parent=wg)
            B.box('wedge', (0.03, 0.07, 0.24), (0, 0, 0), B.mat('wedge', '#e2483a', 0.4, 0.5), bevel=0.004, parent=w)
    B.box('gov_lever', (0.3, 0.05, 0.05), (-(RAIL_X - 0.2), -0.12, -0.12), GOVM, bevel=0.005, parent=car)

    # ---- 釣合おもり(原点は中心) ----
    cw = B.empty('cwt', parent=root); ch = 2.8
    for s in (-1, 1): B.box('cw_frame', (0.06, 0.2, ch), (s * (CW_W / 2 - 0.03), 0, 0), STEEL, bevel=0.005, parent=cw)
    for k in range(12): B.box('cw_block', (CW_W - 0.14, 0.17, ch / 12 - 0.015), (0, 0, -ch / 2 + (k + 0.5) * ch / 12), CWM, bevel=0.008, parent=cw)
    B.box('cw_top', (CW_W, 0.22, 0.12), (0, 0, ch / 2 + 0.06), STEEL, bevel=0.01, parent=cw)

    B.export(os.path.join(HERE, 'elevator.glb'), root)
    B.write_js('elevator', {
        "name": "ロープ式エレベーターの断面(一般的な形、模式)",
        "floor_height_m": FLOOR_H, "floors": NFLOOR, "pit_m": PIT, "machine_y_m": TOP,
        "car": {"width_m": CAR_W, "depth_m": CAR_D, "height_m": CAR_H, "hitch_y_m": CAR_H + 0.85},
        "cwt": {"x_m": CW_X, "height_m": 2.8},
        "sheave": {"x_m": SHEAVE[0], "y_m": SHEAVE[1], "r_m": SHEAVE[2]},
        "governor": {"x_m": GOV[0], "y_m": GOV[1], "r_m": GOV[2], "pulley_y_m": -PIT + 0.55, "lever_x_m": -(RAIL_X - 0.2)},
        "rail_x_m": RAIL_X,
        "ropes": "主索 4 本(かご: x = -0.12..+0.12、綱車の左の接線 x = 0 から右の接線 x = 1.75 へ)と調速機ロープ(x = -1.3 と -0.8)は JS で描く",
        "axes": "glTF: +Y 上、+Z 手前。原点は 1 階の床、昇降路の中心",
    })

if __name__ == '__main__':
    build(); print('elevator', os.path.getsize(os.path.join(HERE, 'elevator.glb')) // 1024, 'KB')
