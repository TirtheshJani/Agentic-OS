"""Lenient JSONL iteration and timestamp parsing.

Six-plus scanners reimplement these primitives; this is the shared version.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

import orjson

PathLike = str | os.PathLike[str]


def iter_jsonl(path: PathLike) -> Iterator[dict]:
    """Yield decoded JSON objects from a JSONL file, skipping malformed lines."""
    p = Path(path)
    if not p.exists():
        return
    with open(p, "rb") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                obj = orjson.loads(raw)
            except (orjson.JSONDecodeError, ValueError):
                continue
            if isinstance(obj, dict):
                yield obj


def parse_ts(value) -> datetime | None:
    """Parse common timestamp shapes (ISO 8601 / 'Z' suffix / unix seconds / unix ms).

    Returns a timezone-aware UTC ``datetime`` or ``None`` if unparseable.
    """
    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, (int, float)):
        # Heuristic: values > 1e12 are milliseconds, otherwise seconds.
        ts = value / 1000.0 if value > 1e12 else float(value)
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None

    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        # Numeric string?
        if s.lstrip("-").replace(".", "", 1).isdigit():
            try:
                return parse_ts(float(s))
            except ValueError:
                return None
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    return None
