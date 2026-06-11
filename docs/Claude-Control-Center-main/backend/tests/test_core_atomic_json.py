from pathlib import Path

from app.core.atomic_json import read_json, write_json_atomic


def test_write_then_read_roundtrip(tmp_path: Path):
    target = tmp_path / "cache" / "thing.json"
    payload = {"a": 1, "b": [2, 3]}
    write_json_atomic(target, payload)
    assert target.exists()
    assert read_json(target) == payload


def test_read_missing_returns_default(tmp_path: Path):
    assert read_json(tmp_path / "missing.json", default={"x": 1}) == {"x": 1}


def test_read_malformed_returns_default(tmp_path: Path):
    bad = tmp_path / "bad.json"
    bad.write_text("not json{")
    assert read_json(bad, default=None) is None


def test_atomic_write_leaves_no_tmp(tmp_path: Path):
    target = tmp_path / "out.json"
    write_json_atomic(target, [1, 2, 3])
    assert not (tmp_path / "out.json.tmp").exists()
