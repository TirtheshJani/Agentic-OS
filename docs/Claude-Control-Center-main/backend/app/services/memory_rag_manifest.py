"""Sidecar manifest of inserted RAG documents.

LightRAG has no native list-documents API, so every insert appends a JSONL
record here. Pure I/O over an explicit path; the caller owns the lock.
"""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import orjson


def append(path: Path, entry: dict[str, Any], lock: threading.Lock) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    line = orjson.dumps(entry) + b"\n"
    with lock:
        with open(path, "ab") as f:
            f.write(line)


def read(path: Path, lock: threading.Lock, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    with lock:
        with open(path, "rb") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = orjson.loads(line)
                except Exception:
                    continue
                if filters:
                    source = filters.get("source")
                    if source and entry.get("source") != source:
                        continue
                    tag = filters.get("tag")
                    if tag and tag not in (entry.get("tags") or []):
                        continue
                out.append(entry)
    return out
