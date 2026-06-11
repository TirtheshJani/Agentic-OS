from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.config import GWS_SNAPSHOT_INTERVAL
from app.services import gws_service

_SNAPSHOT_FILE = Path(__file__).parent.parent.parent / "data" / "gws_snapshot.json"
_lock = threading.Lock()


def _run(args: list[str], timeout: int = 20) -> dict:
    try:
        return gws_service.run_command(args, timeout=timeout, source="snapshot")
    except Exception as exc:
        return {"stdout": "", "stderr": str(exc), "returncode": -1, "duration_ms": 0, "truncated": False}


def _parse_json(raw: str) -> object:
    try:
        return orjson.loads(raw)
    except Exception:
        return raw


def _fetch_inbox() -> dict:
    result = _run(["gmail", "+triage", "--format", "json"])
    if result["returncode"] != 0:
        auth_err = result["returncode"] == 2 or "auth" in result["stderr"].lower()
        return {"error": result["stderr"], "auth_error": auth_err, "items": []}
    return {"items": _parse_json(result["stdout"]), "raw": result["stdout"][:2000]}


def _fetch_agenda() -> dict:
    result = _run(["calendar", "+agenda", "--format", "json"])
    if result["returncode"] != 0:
        auth_err = result["returncode"] == 2 or "auth" in result["stderr"].lower()
        return {"error": result["stderr"], "auth_error": auth_err, "items": []}
    return {"items": _parse_json(result["stdout"]), "raw": result["stdout"][:2000]}


def _fetch_tasks() -> dict:
    list_result = _run(["tasks", "tasklists", "list", "--format", "json"])
    if list_result["returncode"] != 0:
        auth_err = list_result["returncode"] == 2 or "auth" in list_result["stderr"].lower()
        return {"error": list_result["stderr"], "auth_error": auth_err, "items": [], "tasklists": []}

    tasklists_data = _parse_json(list_result["stdout"])
    if not isinstance(tasklists_data, dict):
        return {"items": [], "tasklists": [], "raw": list_result["stdout"][:500]}

    tasklists = tasklists_data.get("items", [])
    if not tasklists:
        return {"items": [], "tasklists": []}

    first_list_id = tasklists[0].get("id", "@default")
    tasks_result = _run([
        "tasks", "tasks", "list",
        "--params", f'{{"tasklist":"{first_list_id}","showCompleted":"false"}}',
        "--format", "json",
    ])
    if tasks_result["returncode"] != 0:
        return {"items": [], "tasklists": tasklists, "error": tasks_result["stderr"]}

    tasks_data = _parse_json(tasks_result["stdout"])
    items = tasks_data.get("items", []) if isinstance(tasks_data, dict) else []
    return {"items": items, "tasklists": tasklists, "active_list": tasklists[0]}


def _fetch_drive_recent() -> dict:
    result = _run([
        "drive", "files", "list",
        "--params", '{"orderBy":"modifiedTime desc","pageSize":10,"fields":"files(id,name,mimeType,modifiedTime,owners)"}',
        "--format", "json",
    ])
    if result["returncode"] != 0:
        auth_err = result["returncode"] == 2 or "auth" in result["stderr"].lower()
        return {"error": result["stderr"], "auth_error": auth_err, "items": []}
    data = _parse_json(result["stdout"])
    items = data.get("files", []) if isinstance(data, dict) else []
    return {"items": items}


def refresh() -> dict:
    inbox = _fetch_inbox()
    agenda = _fetch_agenda()
    tasks = _fetch_tasks()
    drive = _fetch_drive_recent()

    snapshot = {
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
        "inbox": inbox,
        "agenda": agenda,
        "tasks": tasks,
        "drive": drive,
    }
    with _lock:
        _SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SNAPSHOT_FILE.write_bytes(orjson.dumps(snapshot, option=orjson.OPT_INDENT_2))
    return snapshot


def load() -> dict:
    with _lock:
        if not _SNAPSHOT_FILE.exists():
            return {}
        try:
            return orjson.loads(_SNAPSHOT_FILE.read_bytes())
        except Exception:
            return {}


def start_background_refresh() -> None:
    def _worker():
        # Small delay so the app finishes startup before the first expensive fetch
        time.sleep(5)
        while True:
            try:
                refresh()
            except Exception:
                pass
            time.sleep(GWS_SNAPSHOT_INTERVAL)

    t = threading.Thread(target=_worker, daemon=True, name="gws-snapshot")
    t.start()
