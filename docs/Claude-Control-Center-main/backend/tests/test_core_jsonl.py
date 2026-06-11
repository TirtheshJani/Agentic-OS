from datetime import datetime, timezone
from pathlib import Path

from app.core.jsonl import iter_jsonl, parse_ts


def test_iter_jsonl_skips_blank_and_malformed(tmp_path: Path, write_jsonl):
    target = tmp_path / "log.jsonl"
    target.write_text('{"a": 1}\n\nnot-json\n{"b": 2}\n')
    rows = list(iter_jsonl(target))
    assert rows == [{"a": 1}, {"b": 2}]


def test_iter_jsonl_missing_file_yields_nothing(tmp_path: Path):
    assert list(iter_jsonl(tmp_path / "nope.jsonl")) == []


def test_parse_ts_iso_z():
    dt = parse_ts("2025-01-02T03:04:05Z")
    assert dt == datetime(2025, 1, 2, 3, 4, 5, tzinfo=timezone.utc)


def test_parse_ts_unix_seconds_and_ms():
    a = parse_ts(1735776000)
    b = parse_ts(1735776000000)
    assert a == b
    assert a.tzinfo is timezone.utc


def test_parse_ts_garbage_returns_none():
    assert parse_ts("not a date") is None
    assert parse_ts(None) is None
    assert parse_ts("") is None
