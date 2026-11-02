"""DATA_DIR 配下のファイル配信(GLB・テクスチャ・サムネ・動画)。ローカル単一ユーザー前提。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import get_settings

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/{path:path}")
def get_file(path: str) -> FileResponse:
    root = get_settings().data_dir.resolve()
    target = (root / path).resolve()
    if root not in target.parents or not target.is_file():
        raise HTTPException(404, "file not found")
    media = "model/gltf-binary" if target.suffix == ".glb" else None
    return FileResponse(target, media_type=media)
