"""API → inline キュー → dummy ワーカー → ファイル生成、の一気通貫。"""
import os
from pathlib import Path


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["queue_backend"] == "inline"


def _create_asset(client, kind, name, prompt):
    r = client.post("/assets", json={"kind": kind, "name": name, "prompt": {"text": prompt}})
    assert r.status_code == 201, r.text
    return r.json()


def _run(client, kind, params):
    r = client.post("/jobs", json={"kind": kind, "params": params})
    assert r.status_code == 202, r.text
    job = r.json()
    assert job["status"] == "succeeded", job
    return job


def test_humanoid_pipeline(client):
    data = Path(os.environ["DATA_DIR"])
    a = _create_asset(client, "humanoid", "テスト人型", "黒いコートの男性、A ポーズ")
    _run(client, "generate_shape", {"asset_id": a["id"]})
    _run(client, "generate_texture", {"asset_id": a["id"]})
    job = _run(client, "rig", {"asset_id": a["id"]})
    assert job["progress"]["percent"] == 100

    asset = client.get(f"/assets/{a['id']}").json()
    assert asset["files"]["glb"].endswith("rigged.glb")
    assert asset["stats"]["triangles"] > 0
    assert asset["stats"]["texture_size"] == 1024
    assert asset["rig"]["skeleton"] == "std-humanoid-v1"
    assert asset["pipeline"] == {"concept_image": None, "shape": "dummy-shape", "texture": "dummy-texture",
                                 "rig": "dummy-rig"}
    assert (data / asset["files"]["glb"]).stat().st_size > 0

    # /files 配信
    r = client.get(f"/files/{asset['files']['glb']}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "model/gltf-binary"
    assert r.content[:4] == b"glTF"


def test_prop_cannot_be_rigged(client):
    a = _create_asset(client, "prop", "ランタン", "古い真鍮のランタン")
    _run(client, "generate_shape", {"asset_id": a["id"]})
    r = client.post("/jobs", json={"kind": "rig", "params": {"asset_id": a["id"]}})
    job = r.json()
    assert job["status"] == "failed"
    assert job["failure_kind"] == "invalid_input"


def test_scene_roundtrip_and_render(client):
    a = _create_asset(client, "prop", "椅子", "木の椅子")
    _run(client, "generate_shape", {"asset_id": a["id"]})
    scene = client.post("/scenes", json={"name": "テストシーン"}).json()
    scene["duration"] = 1.0
    scene["render"].update({"width": 320, "height": 256, "fps": 24})
    scene["nodes"].append({"id": "node_chair001", "asset_id": a["id"], "name": "chair",
                           "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1]},
                           "visible": True})
    r = client.put(f"/scenes/{scene['id']}", json=scene)
    assert r.status_code == 200, r.text
    assert client.get(f"/scenes/{scene['id']}").json()["nodes"][0]["name"] == "chair"

    job = _run(client, "render_video", {"scene_id": scene["id"]})
    assert job["result"]["frames"] == 24
    data = Path(os.environ["DATA_DIR"])
    assert (data / job["result"]["video"]).stat().st_size > 0
    assert (data / job["result"]["video"]).parent.joinpath("assets.json").exists()


def test_unknown_field_rejected(client):
    scene = client.post("/scenes", json={"name": "x"}).json()
    scene["bogus"] = 1
    assert client.put(f"/scenes/{scene['id']}", json=scene).status_code == 422


def test_job_list_and_cancel(client):
    jobs = client.get("/jobs").json()
    assert len(jobs) >= 1
    # 既に終わったジョブの cancel は何もしない
    j = client.post(f"/jobs/{jobs[0]['id']}/cancel").json()
    assert j["status"] in ("succeeded", "failed")
