"""Pydantic モデルから JSON Schema を書き出す。

    python export_json_schema.py            # packages/schema/json/*.schema.json を更新
"""
from __future__ import annotations

import json
from pathlib import Path

from movie_schema import Asset, Job, Scene

OUT = Path(__file__).parent / "json"


def require_all(node: dict) -> None:
    """API レスポンス用: すべてのプロパティを required にする(既定値付きでも必ず出力されるため)。"""
    if isinstance(node, dict):
        if node.get("type") == "object" and "properties" in node:
            node["required"] = list(node["properties"].keys())
        for v in node.values():
            if isinstance(v, dict):
                require_all(v)
            elif isinstance(v, list):
                for item in v:
                    require_all(item)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for model in (Asset, Scene, Job):
        # serialization モード: API レスポンスでは既定値付きフィールドも必ず含まれるため required 扱いにする
        schema = model.model_json_schema(mode="serialization")
        require_all(schema)
        schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
        schema["$id"] = f"https://3d-movie.local/schema/{model.__name__.lower()}.schema.json"
        path = OUT / f"{model.__name__.lower()}.schema.json"
        path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("wrote", path.relative_to(Path(__file__).parents[2]))


if __name__ == "__main__":
    main()
