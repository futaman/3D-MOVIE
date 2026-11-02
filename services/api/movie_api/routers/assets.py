from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from movie_schema import Asset, AssetKind, PromptSpec

from ..db import AssetRow, get_session, list_rows
from ..ids import new_id

router = APIRouter(prefix="/assets", tags=["assets"])


class AssetCreate(BaseModel):
    kind: AssetKind
    name: str = Field(..., min_length=1, max_length=200)
    prompt: PromptSpec | None = None
    parent_id: str | None = None
    tags: list[str] = []


@router.get("", response_model=list[Asset])
def list_assets(kind: AssetKind | None = None, q: str | None = None, limit: int = Query(100, le=500),
                session: Session = Depends(get_session)) -> list[Asset]:
    filters = []
    if kind:
        filters.append(AssetRow.kind == kind.value)
    if q:
        filters.append(AssetRow.name.ilike(f"%{q}%"))
    rows = list_rows(session, AssetRow, *filters, limit=limit, order_by=AssetRow.created_at.desc())
    return [r.to_model() for r in rows]


@router.post("", response_model=Asset, status_code=201)
def create_asset(body: AssetCreate, session: Session = Depends(get_session)) -> Asset:
    asset = Asset(id=new_id("ast"), kind=body.kind, name=body.name, prompt=body.prompt,
                  parent_id=body.parent_id, tags=body.tags)
    session.add(AssetRow.from_model(asset))
    session.commit()
    return asset


@router.get("/{asset_id}", response_model=Asset)
def get_asset(asset_id: str, session: Session = Depends(get_session)) -> Asset:
    row = session.get(AssetRow, asset_id)
    if not row:
        raise HTTPException(404, "asset not found")
    return row.to_model()


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: str, session: Session = Depends(get_session)) -> None:
    row = session.get(AssetRow, asset_id)
    if not row:
        raise HTTPException(404, "asset not found")
    session.delete(row)
    session.commit()
