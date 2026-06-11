from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.config import CODEX_DIR

_HISTORY = CODEX_DIR / "history.jsonl"
_SESSION_INDEX = CODEX_DIR / "session_index.jsonl"


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    records = []
    try:
        with open(path, "rb") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(orjson.loads(line))
                    except Exception:
                        pass
    except Exception:
        pass
    return records


def read_history(limit: int = 50, page: int = 1, search: str = "") -> dict:
    records = _load_jsonl(_HISTORY)

    if search:
        q = search.lower()
        records = [r for r in records if q in (r.get("text") or "").lower()]

    records.sort(key=lambda r: r.get("ts", 0), reverse=True)

    total = len(records)
    offset = (page - 1) * limit
    page_items = records[offset: offset + limit]

    items = []
    for r in page_items:
        ts = r.get("ts", 0)
        try:
            dt = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        except Exception:
            dt = ""
        items.append({
            "session_id": r.get("session_id", ""),
            "ts": ts,
            "text": r.get("text", ""),
            "datetime": dt,
        })

    return {"total": total, "page": page, "limit": limit, "items": items}


def read_session_index(limit: int = 50, page: int = 1) -> dict:
    records = _load_jsonl(_SESSION_INDEX)
    records.sort(key=lambda r: r.get("updated_at", ""), reverse=True)

    total = len(records)
    offset = (page - 1) * limit
    page_items = records[offset: offset + limit]

    items = [
        {
            "id": r.get("id", ""),
            "thread_name": r.get("thread_name", ""),
            "updated_at": r.get("updated_at", ""),
        }
        for r in page_items
    ]

    return {"total": total, "page": page, "limit": limit, "items": items}
