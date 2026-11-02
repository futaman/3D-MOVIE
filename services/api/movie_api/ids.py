from __future__ import annotations

from ulid import ULID


def new_id(prefix: str) -> str:
    """`ast_01h...` 形式の ID。ULID を小文字 Crockford Base32(26 文字)で付ける。"""
    return f"{prefix}_{str(ULID()).lower()}"
