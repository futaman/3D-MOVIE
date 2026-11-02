"""OOM → quality を下げて再試行する流れを、プロバイダを差し替えて確認する。"""
import os


def test_oom_retry(monkeypatch, tmp_path):
    os.environ.update({"DATABASE_URL": f"sqlite:///{tmp_path}/t.sqlite3", "DATA_DIR": str(tmp_path),
                       "REDIS_URL": "redis://127.0.0.1:1/0"})
    from movie_api import config as api_config
    from movie_worker import config as w_config

    api_config.get_settings.cache_clear()
    w_config.get_worker_settings.cache_clear()
    import movie_api.db as db

    db._engine = None
    db.init_db()

    from movie_api.db import AssetRow, JobRow, session_scope
    from movie_api.ids import new_id
    from movie_schema import Asset, AssetKind, Job, JobKind, PromptSpec
    from movie_worker import tasks
    from movie_worker.providers import registry
    from movie_worker.providers.dummy import DummyShape
    from movie_worker.vram import OutOfMemory

    calls = []

    class FlakyShape(DummyShape):
        def generate(self, req, progress):
            calls.append(req.quality)
            if req.quality == "high":
                raise OutOfMemory("CUDA out of memory")
            return super().generate(req, progress)

    monkeypatch.setattr(registry, "shape_provider", lambda: FlakyShape())

    asset = Asset(id=new_id("ast"), kind=AssetKind.prop, name="x", prompt=PromptSpec(text="box"))
    job = Job(id=new_id("job"), kind=JobKind.generate_shape, params={"asset_id": asset.id})
    with session_scope() as s:
        s.add(AssetRow.from_model(asset))
        s.add(JobRow.from_model(job))
        s.commit()

    tasks.run_job(job.id)
    with session_scope() as s:
        done = s.get(JobRow, job.id).to_model()
    assert calls == ["high", "medium"]
    assert done.status.value == "succeeded"
    assert done.attempt == 2
    assert done.params["quality"] == "medium"
