# 3D-MOVIE

プロンプトから 3D モデルアセットを生成し(**Forge**)、それを動かして動画にする(**Studio**)個人用 Web アプリ。
専門知識が要る仕組みを縦型ショートで正確に解説する動画を半自動で作る **Explain** モードも計画中。
自分の Windows PC(RTX 3060 12GB)上で WSL2 + Docker で動かす。

| ドキュメント | 内容 |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | 仕様書 v1.0(要件・構成・12GB 運用方針・ロードマップ) |
| [docs/EXPLAIN.md](docs/EXPLAIN.md) | Explain モード仕様書 v0.1(専門解説の縦型ショート動画を AI で正確に作る) |
| [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md) | Windows + WSL2 + Docker Desktop + GPU のセットアップ手順(未経験者向け) |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 開発ガイド(構成、動かし方、ジョブの流れ、プロバイダの追加) |
| [scripts/phase0/README.md](scripts/phase0/README.md) | フェーズ 0 技術検証の手順 |

## クイックスタート

```bash
# GPU なしで配管を確認(dummy プロバイダ)
make setup && make test
make api-dev      # http://localhost:8000/docs
make web-dev      # http://localhost:3000

# GPU あり(WSL2 + Docker Desktop)
cp .env.example .env && docker compose up --build -d
```

## 現在の状態

骨組み(skeleton)。dummy プロバイダで「アセット作成 → 形状 → テクスチャ → リグ → シーン配置 → レンダリング(MP4)」が
一気通貫で動き、テストで検証済み。実モデル(Hunyuan3D 2 / UniRig / Blender EEVEE)への差し替えはフェーズ 0 で行う。
