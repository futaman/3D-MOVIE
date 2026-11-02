"""SQLAlchemy の永続化層。

Pydantic モデル(movie_schema)を正とし、DB には検索用の列 + JSON 本体を保存する。
"""
from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from movie_schema import Asset, Job, Scene

from .config import get_settings


class Base(DeclarativeBase):
    pass


class AssetRow(Base):
    __tablename__ = "assets"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    parent_id: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)
    owner_id: Mapped[str] = mapped_column(String(40), default="local", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    body: Mapped[dict] = mapped_column(JSON)

    @classmethod
    def from_model(cls, a: Asset) -> AssetRow:
        return cls(id=a.id, kind=a.kind.value, name=a.name, parent_id=a.parent_id, owner_id=a.owner_id,
                   created_at=a.created_at, body=a.model_dump(mode="json"))

    def to_model(self) -> Asset:
        return Asset.model_validate(self.body)


class SceneRow(Base):
    __tablename__ = "scenes"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    body: Mapped[dict] = mapped_column(JSON)

    def to_model(self) -> Scene:
        return Scene.model_validate(self.body)


class JobRow(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    kind: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[dict] = mapped_column(JSON)

    @classmethod
    def from_model(cls, j: Job) -> JobRow:
        return cls(id=j.id, kind=j.kind.value, status=j.status.value, attempt=j.attempt,
                   created_at=j.created_at, error=j.error, body=j.model_dump(mode="json"))

    def update_from_model(self, j: Job) -> None:
        self.status = j.status.value
        self.attempt = j.attempt
        self.error = j.error
        self.body = j.model_dump(mode="json")

    def to_model(self) -> Job:
        return Job.model_validate(self.body)


def make_engine(url: str | None = None):
    url = url or get_settings().database_url
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    return create_engine(url, **kwargs)


_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        _engine = make_engine()
        _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def init_db() -> None:
    Base.metadata.create_all(get_engine())


def session_scope() -> Session:
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal()


def get_session() -> Iterator[Session]:
    """FastAPI 依存性。"""
    with session_scope() as s:
        yield s


def list_rows(session: Session, model, *filters, limit: int = 100, order_by=None):
    stmt = select(model)
    for f in filters:
        stmt = stmt.where(f)
    if order_by is not None:
        stmt = stmt.order_by(order_by)
    return list(session.scalars(stmt.limit(limit)))
