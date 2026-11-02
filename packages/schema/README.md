# packages/schema

アセット・シーン・ジョブの共通スキーマ。**Pydantic モデル(`movie_schema/`)が唯一の正**で、そこから派生物を生成する。

| 生成物 | 利用側 | コマンド |
|---|---|---|
| `json/*.schema.json` | ドキュメント、他言語 | `python export_json_schema.py` |
| `apps/web/src/types/schema.d.ts` | Next.js(TypeScript) | リポジトリルートで `make schema` |

`services/api` と `services/worker` はこのパッケージを editable install して直接 import する。
モデルを変更したら `make schema` を実行し、生成物も一緒にコミットする。
