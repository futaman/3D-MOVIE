# 開発ガイド

## 構成

```
3D-MOVIE/
├─ apps/web/                 Next.js(/forge /studio /library /jobs /settings)。R3F ビューア、WS で進捗受信
├─ services/api/             FastAPI。アセット・シーン・ジョブ CRUD、/files 配信、/ws/jobs 進捗中継
├─ services/worker/          GPU ワーカー(RQ)。providers(抽象+dummy+実モデル stub)、pipelines、vram、blender/
├─ packages/schema/          Pydantic スキーマ(唯一の正)→ JSON Schema → TS 型
├─ scripts/phase0/           技術検証(モデルベンチ、Mixamo 取り込み、EEVEE 最小レンダリング)
├─ docker/                   api / worker / web の Dockerfile
├─ docker-compose.yml        postgres + redis + api + worker(GPU)+ web
├─ data/                     (git 管理外)重み・アセット・モーション・レンダリング結果
└─ docs/                     SPEC.md(仕様)、SETUP_WINDOWS.md(環境構築)、本書
```

## 2 つの動かし方

### A. Docker で全部(本番相当。GPU 必要)
```bash
cp .env.example .env          # ANTHROPIC_API_KEY などを記入
docker compose up --build -d
# web: http://localhost:3000  api: http://localhost:8000/docs
docker compose logs -f worker
```

### B. ローカル開発(GPU / Docker 不要、dummy プロバイダ)
```bash
make setup                    # .venv + npm install
make test                     # API 6 件 + worker 4 件
make api-dev                  # sqlite + inline キュー(ジョブは API プロセス内で即実行)
make web-dev                  # 別ターミナル。http://localhost:3000
```
inline モードでは Redis が無いため WebSocket 進捗は流れないが、ジョブ API は同期的に完了して返る。

## ジョブの流れ

```
web ──POST /jobs──▶ api ──RQ(redis "gpu")──▶ worker.run_job
                     │                            ├ providers.registry で実装を選ぶ(.env の *_PROVIDER)
                     │                            ├ vram.hold でモデルを読み込み、終了時に解放
                     │                            ├ OOM → quality を high→medium→low に落として再試行
                     ◀──Redis pub/sub "jobs"───── └ 進捗ごとに DB 更新 + publish
web ◀──WS /ws/jobs── api(中継)
```

## 新しいプロバイダを足す

1. `services/worker/movie_worker/providers/<name>.py` に `ShapeProvider` などの実装を書く(`vram.hold` 内でモデルをロード)。
2. `providers/registry.py` のテーブルに登録。
3. `.env` の `SHAPE_PROVIDER=<name>` で切り替え。
4. `scripts/phase0/bench_shape.py --providers <name>` で時間と VRAM を測る。

## スキーマ変更

`packages/schema/movie_schema/*.py` を編集 → `make schema` → 生成物(`json/*.schema.json`, `apps/web/src/types/schema/*.d.ts`)もコミット。
`extra="forbid"` なので、未知フィールドは API で 422 になる。

## 規約

- ID: `ast_` / `scn_` / `job_` + ULID 小文字 26 桁。
- ファイルパスは DATA_DIR からの相対で DB に保存し、`/files/<rel>` で配信。
- 座標系: シーン JSON は Y-up(Three.js)。Blender 側インポータで Z-up に変換。
- 人型スケルトンは `std-humanoid-v1`(Mixamo 互換、ボーン名は小文字スネーク)。
