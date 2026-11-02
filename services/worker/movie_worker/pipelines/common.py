"""パイプライン共通: アセットの読み書き、保存先の規約。

保存先: DATA_DIR/assets/<asset_id>/v<version>/{shape.glb, model.glb, rigged.glb, albedo.png, thumb.png}
ジョブ中間物: DATA_DIR/tmp/<job_id>/
"""
from __future__ import annotations

from pathlib import Path

from movie_api.db import AssetRow, session_scope
from movie_schema import Asset
from movie_schema.common import utcnow

from ..config import get_worker_settings


def data_dir() -> Path:
    return get_worker_settings().data_dir


def asset_dir(asset: Asset) -> Path:
    d = data_dir() / "assets" / asset.id / f"v{asset.version}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def tmp_dir(job_id: str) -> Path:
    d = data_dir() / "tmp" / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def rel(path: Path) -> str:
    """DATA_DIR からの相対パス(API の /files/<rel> で配信される)。"""
    return str(Path(path).resolve().relative_to(data_dir().resolve()))


def load_asset(asset_id: str) -> Asset:
    with session_scope() as s:
        row = s.get(AssetRow, asset_id)
        if row is None:
            raise ValueError(f"asset not found: {asset_id}")
        return row.to_model()


def save_asset(asset: Asset) -> None:
    asset.updated_at = utcnow()
    with session_scope() as s:
        row = s.get(AssetRow, asset.id)
        if row is None:
            s.add(AssetRow.from_model(asset))
        else:
            row.body = asset.model_dump(mode="json")
            row.name = asset.name
        s.commit()
