# Windows セットアップ手順書(WSL2 + Docker Desktop + GPU)

対象: Windows デスクトップ PC、RTX 3060 12GB、RAM 48GB。WSL2 と Docker が初めての人向け。
所要時間の目安: 1〜2 時間(ダウンロード待ちを含む)。再起動が 2〜3 回入ります。

やることの全体像:

```
[1] Windows 側の準備(更新・仮想化の確認)
[2] NVIDIA ドライバを最新にする(Windows 側だけ)
[3] WSL2 と Ubuntu を入れる
[4] Ubuntu の中から GPU が見えることを確認
[5] Docker Desktop を入れて WSL2 と連携させる
[6] Docker のコンテナから GPU が見えることを確認(ここがゴール)
[7] メモリ割り当てと保存場所の設定
[8] Git とエディタの準備、リポジトリの取得
```

用語の最低限:
- **WSL2**: Windows の中で本物の Linux(Ubuntu)を動かす仕組み。AI モデルの多くは Linux 前提なので必要。
- **Docker**: アプリとその動作環境を「コンテナ」という箱にまとめて動かす仕組み。環境構築の手間を箱ごと配れる。
- **Docker Desktop**: Docker を Windows で GUI 付きで使えるようにしたもの。WSL2 と GPU の連携を自動でやってくれる。

---

## [1] Windows 側の準備

1. **Windows Update をすべて適用**し、再起動する(Windows 10 なら 21H2 以降、Windows 11 推奨)。
2. **仮想化が有効か確認**: `Ctrl + Shift + Esc` でタスクマネージャー → 「パフォーマンス」→「CPU」→ 右下の「仮想化: 有効」を確認。
   - 「無効」の場合は PC の BIOS/UEFI 設定で `Intel VT-x` / `AMD-V`(または `SVM Mode`)を有効にする。メーカーごとに場所が違うので「(PC メーカー名) 仮想化 有効」で検索。
3. **C: ドライブの空き容量を確認**: 最低 150GB、できれば 300GB。足りない場合は [7] で保存場所を別ドライブに移す。

## [2] NVIDIA ドライバ(Windows 側だけ)

1. https://www.nvidia.com/ja-jp/drivers/ で RTX 3060 用の最新ドライバ(Game Ready / Studio どちらでも可)をダウンロードして入れる。
2. 再起動後、PowerShell(スタートメニューで「PowerShell」と検索)で次を実行し、表が出れば OK。

```powershell
nvidia-smi
```

> 重要: **CUDA Toolkit を Windows に入れる必要はありません**。また、後で入れる Ubuntu の中に NVIDIA ドライバを入れてはいけません(壊れます)。GPU を使うための部品は Windows 側ドライバが WSL2 に自動で提供します。

## [3] WSL2 と Ubuntu

1. PowerShell を **管理者として実行**(スタートで PowerShell を右クリック → 管理者として実行)。
2. 次を実行する。

```powershell
wsl --install -d Ubuntu-24.04
```

3. 再起動を求められたら再起動する。再起動後に Ubuntu のウィンドウが自動で開き、**ユーザー名とパスワード**を聞かれるので決めて入力する(パスワード入力中は何も表示されないのが正常)。
4. Ubuntu のウィンドウで次を実行し、`WSL version: 2.x` と表示されることを確認。

```bash
wsl.exe --version
```

5. Ubuntu を最新にする(数分かかる)。

```bash
sudo apt update && sudo apt upgrade -y
```

以後、「Ubuntu で実行」と書いてある手順は、スタートメニューの「Ubuntu 24.04」を開いて実行します。

## [4] Ubuntu から GPU が見えることを確認

Ubuntu で実行:

```bash
nvidia-smi
```

Windows と同じような表が出て、`NVIDIA GeForce RTX 3060` と `12288MiB` が見えれば OK。
出ない場合は、Windows 側ドライバが古いか、WSL が 1 になっている。`wsl --update` を PowerShell(管理者)で実行して再起動。

## [5] Docker Desktop

1. https://www.docker.com/products/docker-desktop/ から Windows 版をダウンロードして入れる。個人利用は無料。
2. インストール中「Use WSL 2 instead of Hyper-V」にチェックが付いていることを確認。
3. 再起動後 Docker Desktop を起動。アカウント作成は「Skip」で構わない。
4. 右上の歯車(Settings)→ **Resources → WSL integration** → `Ubuntu-24.04` のスイッチを ON → **Apply & restart**。
5. Ubuntu で次を実行し、バージョンが表示されれば連携できている。

```bash
docker --version
docker compose version
```

## [6] コンテナから GPU が見えることを確認(ゴール)

Ubuntu で実行(初回は 1〜2 分ダウンロードが入る):

```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

RTX 3060 の表が出れば **環境構築は完了**です。Docker Desktop が NVIDIA Container Toolkit 相当を内蔵しているので、追加の設定は不要です。

うまくいかないときは [トラブルシューティング](#トラブルシューティング) へ。

## [7] メモリ割り当てと保存場所

### 7-1. WSL2 のメモリ上限(RAM 48GB のうち 32GB を割り当てる)

WSL2 は既定で RAM の半分しか使いません。モデルの CPU オフロードのために 32GB に上げます。

1. エクスプローラーのアドレス欄に `%UserProfile%` と入れて開く(`C:\Users\<あなたの名前>`)。
2. そこに **`.wslconfig`** という名前のファイルを作り(メモ帳で可。拡張子なし・先頭ドット)、次を書いて保存する。

```ini
[wsl2]
memory=32GB
swap=16GB
processors=8
```

> `processors` は CPU のコア数に合わせて調整(全コアの 7〜8 割が目安)。

3. PowerShell で `wsl --shutdown` を実行し、Docker Desktop を再起動すると反映される。Ubuntu で `free -g` を実行し、`Mem:` の total が 31 前後なら OK。

### 7-2. ファイルは Ubuntu 側に置く

- このプロジェクトの作業フォルダ・モデル重み・生成アセットは **Ubuntu 側のホーム(`~/`)に置く**。Windows 側(`/mnt/c/...`)に置くとディスク速度が 5〜10 倍遅くなる。
- Ubuntu 側のファイルは Windows のエクスプローラーから `\\wsl$\Ubuntu-24.04\home\<ユーザー名>` で開ける(左ペインの「Linux」からも辿れる)。書き出した動画はここからコピーする。

### 7-3. C: の空きが足りない場合(任意)

WSL2 と Docker のデータは既定で C: の仮想ディスクに入る。別ドライブ(例 D:)に移すには:

- **Docker**: Docker Desktop → Settings → Resources → Advanced → `Disk image location` を D: 以下に変更。
- **Ubuntu**: PowerShell で `wsl --manage Ubuntu-24.04 --move D:\WSL\Ubuntu`(WSL 2.x 系で利用可)。古い WSL なら `wsl --export` / `wsl --import` で移す。

## [8] Git とエディタ、リポジトリの取得

Ubuntu で実行:

```bash
sudo apt install -y git
git config --global user.name "あなたの名前"
git config --global user.email "あなたのメールアドレス"
cd ~
git clone https://github.com/futaman/3D-MOVIE.git
cd 3D-MOVIE
```

> プライベートリポジトリの場合、clone 時に GitHub のユーザー名と **Personal Access Token**(パスワードではない)を聞かれる。GitHub → Settings → Developer settings → Personal access tokens で `repo` 権限のトークンを作って貼り付ける。

エディタは **VS Code** を推奨。Windows 側に VS Code を入れ、拡張機能「WSL」を追加すると、Ubuntu で `code .` と打つだけで Ubuntu 側のフォルダを Windows の VS Code で編集できる。

## 完了チェックリスト

- [ ] PowerShell で `nvidia-smi` が通る
- [ ] Ubuntu で `nvidia-smi` が通る
- [ ] Ubuntu で `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi` が通る
- [ ] Ubuntu で `free -g` の total が 31 前後
- [ ] `~/3D-MOVIE` にリポジトリが clone できている

ここまで通れば、以後はリポジトリ内で `docker compose up` を実行するだけでアプリ一式が立ち上がる構成にします。

---

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `wsl --install` で「仮想化が無効」系のエラー | BIOS/UEFI で VT-x / AMD-V(SVM)を有効にする。[1]-2 を参照 |
| Ubuntu で `nvidia-smi` が「command not found」 | Windows 側ドライバが古い。[2] で最新にして再起動。WSL 内にドライバを入れてはいけない |
| `docker: command not found`(Ubuntu) | Docker Desktop の WSL integration で Ubuntu-24.04 が ON になっていない。[5]-4 を確認 |
| `docker run --gpus all` で「could not select device driver」 | Docker Desktop を再起動。それでも出る場合は Docker Desktop を最新版に更新 |
| 生成中に `CUDA out of memory` | 想定内。アプリ側で解像度を落として自動再試行する。別の GPU 利用アプリ(ゲーム、ブラウザのハードウェアアクセラレーション)を閉じると 1〜2GB 空く |
| WSL のディスクが肥大化して C: が減る | PowerShell で `wsl --shutdown` の後、Docker Desktop → Troubleshoot → `Clean / Purge data`、または `docker system prune` で不要イメージを削除 |
| Ubuntu が重い・固まる | `.wslconfig` の `memory` を 24GB に下げてみる。Windows 側に 16GB 以上は残す |
| `\\wsl$` がエクスプローラーで開けない | Ubuntu を一度起動してから開く(停止中は見えない) |

困ったら、エラーメッセージの全文と、どの手順の何番目かをそのまま貼ってください。
