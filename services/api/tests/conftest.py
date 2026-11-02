import os
import pathlib

import pytest


@pytest.fixture(scope="session", autouse=True)
def _env(tmp_path_factory):
    """sqlite + inline キュー + 一時 DATA_DIR で、Redis/Postgres/GPU なしに配管を通す。"""
    data = tmp_path_factory.mktemp("data")
    db = tmp_path_factory.mktemp("db") / "test.sqlite3"
    os.environ.update({
        "DATABASE_URL": f"sqlite:///{db}",
        "QUEUE_BACKEND": "inline",
        "DATA_DIR": str(data),
        "REDIS_URL": "redis://127.0.0.1:1/0",  # 接続不可。publish は握りつぶされる
        "SHAPE_PROVIDER": "dummy", "TEXTURE_PROVIDER": "dummy", "RIG_PROVIDER": "dummy",
        "RENDERER": "dummy",
    })
    yield
    pathlib.Path(db).unlink(missing_ok=True)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from movie_api.main import app

    with TestClient(app) as c:
        yield c
