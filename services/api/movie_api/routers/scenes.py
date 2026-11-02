from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from movie_schema import Scene
from movie_schema.common import utcnow

from ..db import SceneRow, get_session, list_rows
from ..ids import new_id

router = APIRouter(prefix="/scenes", tags=["scenes"])


class SceneCreate(BaseModel):
    name: str = "untitled"


@router.get("", response_model=list[Scene])
def list_scenes(session: Session = Depends(get_session)) -> list[Scene]:
    return [r.to_model() for r in list_rows(session, SceneRow, order_by=SceneRow.updated_at.desc())]


@router.post("", response_model=Scene, status_code=201)
def create_scene(body: SceneCreate, session: Session = Depends(get_session)) -> Scene:
    scene = Scene(id=new_id("scn"), name=body.name)
    session.add(SceneRow(id=scene.id, name=scene.name, updated_at=utcnow(), body=scene.model_dump(mode="json")))
    session.commit()
    return scene


@router.get("/{scene_id}", response_model=Scene)
def get_scene(scene_id: str, session: Session = Depends(get_session)) -> Scene:
    row = session.get(SceneRow, scene_id)
    if not row:
        raise HTTPException(404, "scene not found")
    return row.to_model()


@router.put("/{scene_id}", response_model=Scene)
def put_scene(scene_id: str, scene: Scene, session: Session = Depends(get_session)) -> Scene:
    """シーン全体を保存する。Studio は編集のたびに(デバウンスして)これを呼ぶ。"""
    if scene.id != scene_id:
        raise HTTPException(400, "scene id mismatch")
    row = session.get(SceneRow, scene_id)
    if not row:
        raise HTTPException(404, "scene not found")
    row.name = scene.name
    row.updated_at = utcnow()
    row.body = scene.model_dump(mode="json")
    session.commit()
    return scene
