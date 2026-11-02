import pytest

from movie_worker.vram import OutOfMemory, hold, next_quality


def test_hold_converts_oom():
    def loader():
        raise RuntimeError("CUDA out of memory. Tried to allocate 2.00 GiB")

    with pytest.raises(OutOfMemory):
        with hold(loader):
            pass


def test_hold_passes_other_errors():
    def loader():
        raise ValueError("bad")

    with pytest.raises(ValueError):
        with hold(loader):
            pass


def test_quality_ladder():
    assert next_quality("high") == "medium"
    assert next_quality("medium") == "low"
    assert next_quality("low") is None
    assert next_quality("weird") == "medium"
