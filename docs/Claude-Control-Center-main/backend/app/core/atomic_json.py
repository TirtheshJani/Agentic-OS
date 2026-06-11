"""Atomic JSON read/write helpers.

`write_json_atomic` follows the .tmp -> os.replace pattern used across the
codebase so a crash mid-write can never leave a half-written cache file.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import orjson

PathLike = str | os.PathLike[str]


def read_json(path: PathLike, default: Any = None) -> Any:
    """Read a JSON file, returning ``default`` if missing or malformed."""
    p = Path(path)
    if not p.exists():
        return default
    try:
        with open(p, "rb") as f:
            return orjson.loads(f.read())
    except (orjson.JSONDecodeError, ValueError, OSError):
        return default


def write_json_atomic(path: PathLike, data: Any, *, indent: bool = False) -> None:
    """Serialise ``data`` to ``path`` atomically via a sibling .tmp file.

    Creates parent directories as needed. Uses ``os.replace`` for the swap,
    which is atomic on POSIX and Windows for same-filesystem targets.
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    option = orjson.OPT_INDENT_2 if indent else 0
    payload = orjson.dumps(data, option=option)
    with open(tmp, "wb") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, p)
