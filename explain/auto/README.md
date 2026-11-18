# auto-short: ネタ落ち型の解説ショートを自動で作る

真面目な計算 → 非常識な仮定 → **浜名湖に着地**、という型のショート動画(1080×1920)を、台本 JSON から MP4、YouTube への非公開アップロードまで自動で作る。映像は 2D の図解をコードで描く(動画生成 AI は使わない)。

```
テーマ ─▶ episode.json(台本・計算・出典) ─▶ verify(計算をやり直して照合)
       ─▶ visuals.js(場面ごとの絵) ─▶ 静止画 QA ─▶ tts(VOICEVOX、尺を決める)
       ─▶ sfx(BGM・効果音をコードで合成) ─▶ render(1 コマずつ描画) ─▶ compose ─▶ meta ─▶ upload(非公開)
```

## 使い方

```bash
cd explain/auto
npm install && npx playwright install chromium      # 最初の 1 回
node bin/run.mjs episodes/01-paper-plane             # VOICEVOX が動いていれば音声つき、なければ音声なしの下書き
node bin/run.mjs episodes/01-paper-plane --upload    # 非公開でアップロードまで
```

Claude Code では `/auto-short <テーマ>` で、台本と絵を書くところから最後まで進む(`.claude/skills/auto-short/SKILL.md`)。

| スクリプト | すること |
|---|---|
| `bin/verify.mjs` | `checks` の式を計算し直して台本の数字と照合。合わなければ中止。`facts` の未確認を一覧 |
| `bin/tts.mjs` | VOICEVOX で場面ごとに合成し、音声の長さから尺を決める(`out/timing.json`) |
| `bin/sfx.mjs` | BGM と効果音を合成(素材ファイルなし) |
| `bin/render.cjs` | 1 コマずつ描いて `out/video.mp4`。`out/qa/` に場面ごとの静止画と自動 QA の結果 |
| `bin/compose.mjs` | 音を重ねて `out/final.mp4`(-14 LUFS) |
| `bin/meta.mjs` / `bin/upload.mjs` | タイトル・説明文(計算の前提と出典入り)を作り、非公開でアップロード |

## Windows での準備(1 回)

1. [VOICEVOX](https://voicevox.hiroshiba.jp/) を入れて起動しておく(起動中は `http://127.0.0.1:50021` で使える)。使う話者の利用規約を確認する。
2. Node.js 20 以上と ffmpeg を入れる(`winget install OpenJS.NodeJS.LTS Gyan.FFmpeg`)。
3. YouTube へのアップロード(使う場合):
   1. Google Cloud で新しいプロジェクトを作り、「YouTube Data API v3」を有効にする。
   2. 「OAuth 同意画面」を外部・テスト中で作り、自分の Google アカウントをテストユーザーに追加する。
   3. 「認証情報」で OAuth クライアント ID(種類: デスクトップアプリ)を作る。
   4. 環境変数 `YT_CLIENT_ID` と `YT_CLIENT_SECRET` に設定し、`node bin/yt-auth.mjs` を実行して、表示された URL をブラウザで開いて許可する。

   審査を受けていないプロジェクトからのアップロードは非公開に固定されるが、ここでは非公開で上げて人が公開する運用なので問題ない。テスト中の同意画面ではリフレッシュトークンが 7 日で切れるので、切れたら `yt-auth.mjs` をやり直す。

## 毎日自動で作る

Windows のタスクスケジューラで、リポジトリの場所を作業フォルダにして次を実行する(Claude Code がテーマ決めから非公開アップロードまで行う):

```
claude -p "/auto-short 新しいテーマで 1 本作り、非公開でアップロードして" --permission-mode acceptEdits
```

量産するほど、テンプレートの使い回しだけの動画は YouTube の収益化の対象外(inauthentic content)になりやすい。回ごとに題材・計算・絵を変えること、公開前に人が見ることを運用の前提にする。

## まだ確かめていないこと

- VOICEVOX での音声合成と YouTube へのアップロードは、開発した環境に VOICEVOX も認証情報もなかったため実行していない(コードは書いてある)。最初の実行で不具合があれば直す。
