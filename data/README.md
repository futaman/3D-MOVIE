# data/

Git 管理外。Docker Compose から `/data` としてマウントされる。

```
data/
├─ models/      # モデル重み(Hunyuan3D, UniRig, SDXL-Turbo など)
├─ assets/      # 生成アセット(ast_xxx/vN/model.glb, textures/, thumb.png)
├─ motions/     # モーションクリップ(std-humanoid-v1 形式の GLB)
├─ hdri/        # 環境マップ
├─ renders/     # 書き出し動画
└─ tmp/         # 中間成果物(7 日で自動削除)
```

WSL2 側の ext4 上に置くこと(`/mnt/c` 配下に置かない)。
