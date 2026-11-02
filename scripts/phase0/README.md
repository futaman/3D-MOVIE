# scripts/phase0 — 技術検証

RTX 3060 12GB での採用モデルと所要時間を実測で確定するためのスクリプト群。結果は `data/bench/` に残し、
`docs/SPEC.md` の 8.3 節(見込み所要時間)を実測値で更新する。

| スクリプト | 目的 | 実行例 |
|---|---|---|
| `bench_shape.py` | 形状生成モデル比較(時間・VRAM・三角形数・成否) | `python scripts/phase0/bench_shape.py --providers dummy --limit 2` |
| `import_mixamo.py` | Mixamo FBX → std-humanoid-v1 GLB | `blender -b --python scripts/phase0/import_mixamo.py -- --in data/raw/mixamo --out data/motions` |
| `render_min.py` | EEVEE 最小レンダリングと sec/frame 実測 | `python scripts/phase0/render_min.py --glb data/assets/<id>/v1/model.glb` |

手順:
1. `docs/SETUP_WINDOWS.md` で環境を作る。
2. `make setup` → `make test` で配管(dummy)が通ることを確認。
3. `bench_shape.py --providers dummy` で CSV が出ることを確認(配管の確認)。
4. `services/worker/movie_worker/providers/hunyuan3d.py` を実装し、`requirements-gpu.txt` を固定、Docker イメージを再ビルド。
5. `bench_shape.py --providers hunyuan3d --quality high|medium|low` を回し、OOM 境界と時間を記録。
6. Mixamo を 20 本取り込み、UniRig でリグした人型に当てて破綻を確認(UniRig プロバイダ実装後)。
7. `render_min.py` で 1080p EEVEE の sec/frame を測り、SPEC 8.3 を更新。
