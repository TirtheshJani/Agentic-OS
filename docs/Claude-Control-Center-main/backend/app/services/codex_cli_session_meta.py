from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import orjson

_META_FILE = Path(__file__).parent.parent.parent / "data" / "codex_cli_session_meta.json"
_lock = threading.Lock()
_NOTE_LIMIT = 2000


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _normalize(meta: dict[str, Any] | None) -> dict[str, Any]:
    raw = meta or {}
    note = raw.get("note")
    if note is None:
        note = ""
    if not isinstance(note, str):
        note = str(note)

    return {
        "starred": bool(raw.get("starred", False)),
        "archived": bool(raw.get("archived", False)),
        "note": note[:_NOTE_LIMIT],
        "updated_at": raw.get("updated_at"),
    }


def _read_raw() -> dict[str, dict[str, Any]]:
    if not _META_FILE.exists():
        return {}
    try:
        with _lock:
            loaded = orjson.loads(_META_FILE.read_bytes())
        if isinstance(loaded, dict):
            return loaded
    except Exception:
        return {}
    return {}


def _write_raw(data: dict[str, dict[str, Any]]) -> None:
    with _lock:
        _META_FILE.parent.mkdir(parents=True, exist_ok=True)
        _META_FILE.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))


def load_all() -> dict[str, dict[str, Any]]:
    raw = _read_raw()
    return {sid: _normalize(meta) for sid, meta in raw.items()}


def merge(session: dict[str, Any], meta_map: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    session_id = session.get("session_id") or ""
    if meta_map is None:
        meta_map = load_all()
    meta = _normalize(meta_map.get(session_id))
    return {**session, **meta}


def update(session_id: str, changes: dict[str, Any]) -> dict[str, Any]:
    if not session_id:
        raise ValueError("session_id required")

    raw = _read_raw()
    current = _normalize(raw.get(session_id))

    if "starred" in changes:
        current["starred"] = bool(changes["starred"])

    if "archived" in changes:
        current["archived"] = bool(changes["archived"])

    if "note" in changes:
        note = changes["note"]
        if note is None:
            note = ""
        if not isinstance(note, str):
            note = str(note)
        current["note"] = note.strip()[:_NOTE_LIMIT]

    current["updated_at"] = _now_iso()
    raw[session_id] = current
    _write_raw(raw)
    return current
