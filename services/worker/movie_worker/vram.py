"""VRAM 管理。12GB で成立させるための中核。

- 1 ジョブ 1 モデル: `hold(model_loader)` で読み込み、ブロックを抜けたら必ず解放する
- OOM を検知したら `OutOfMemory` を投げ、上位(tasks.run_job)が解像度を一段落として再試行する
- torch が無い環境(dummy プロバイダ)でも動く
"""
from __future__ import annotations

import gc
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any, TypeVar

T = TypeVar("T")


class OutOfMemory(RuntimeError):
    pass


def _torch():
    try:
        import torch  # type: ignore

        return torch
    except ImportError:
        return None


def vram_used_mb() -> int | None:
    t = _torch()
    if t is None or not t.cuda.is_available():
        return None
    return int(t.cuda.memory_allocated() / 1024 / 1024)


def vram_total_mb() -> int | None:
    t = _torch()
    if t is None or not t.cuda.is_available():
        return None
    return int(t.cuda.get_device_properties(0).total_memory / 1024 / 1024)


def release() -> None:
    gc.collect()
    t = _torch()
    if t is not None and t.cuda.is_available():
        t.cuda.empty_cache()
        t.cuda.ipc_collect()


def is_oom(exc: BaseException) -> bool:
    t = _torch()
    if t is not None and isinstance(exc, getattr(t.cuda, "OutOfMemoryError", ())):
        return True
    return "out of memory" in str(exc).lower()


@contextmanager
def hold(loader: Callable[[], T]) -> Iterator[T]:
    """モデルを読み込み、ブロック終了時に確実に解放する。OOM は OutOfMemory に変換する。"""
    model: Any = None
    try:
        model = loader()
        yield model
    except Exception as exc:  # noqa: BLE001
        if is_oom(exc):
            raise OutOfMemory(str(exc)) from exc
        raise
    finally:
        del model
        release()


# OOM 時のフォールバック梯子。ジョブ params["quality"] をこの順で下げて再試行する
QUALITY_LADDER = ["high", "medium", "low"]


def next_quality(current: str) -> str | None:
    if current not in QUALITY_LADDER:
        return "medium"
    i = QUALITY_LADDER.index(current)
    return QUALITY_LADDER[i + 1] if i + 1 < len(QUALITY_LADDER) else None
