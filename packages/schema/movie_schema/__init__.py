"""3D-MOVIE 共通スキーマ。

- asset.py : アセット(人型 / 小物 / モーション / 環境 / 音声)
- scene.py : Studio のシーン定義(ブラウザと Blender の両レンダラが解釈する唯一の正)
- job.py   : 非同期ジョブ(種別・状態・進捗)
"""
from .asset import *  # noqa: F401,F403
from .job import *  # noqa: F401,F403
from .scene import *  # noqa: F401,F403

SCHEMA_VERSION = "1.0.0"
