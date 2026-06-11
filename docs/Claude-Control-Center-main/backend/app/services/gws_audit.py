from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path

import orjson

_AUDIT_FILE = Path(__file__).parent.parent.parent / "data" / "gws_audit.jsonl"
_lock = threading.Lock()


def append(record: dict) -> None:
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        **record,
    }
    with _lock:
        _AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_AUDIT_FILE, "ab") as f:
            f.write(orjson.dumps(record) + b"\n")


def load(limit: int = 200) -> list[dict]:
    if not _AUDIT_FILE.exists():
        return []
    records: list[dict] = []
    with _lock:
        with open(_AUDIT_FILE, "rb") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(orjson.loads(line))
                except Exception:
                    continue
    return list(reversed(records[-limit:]))


def clear() -> None:
    with _lock:
        if _AUDIT_FILE.exists():
            _AUDIT_FILE.unlink()
