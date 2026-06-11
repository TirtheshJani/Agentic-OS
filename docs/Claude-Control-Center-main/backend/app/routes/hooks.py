from pathlib import Path
from flask import Blueprint, jsonify, request

from app.config import CODEX_DIR
from app.services.settings_io import read_global, write_global, read_project, write_project
from app.services.project_decoder import decode_project_dir

bp = Blueprint("hooks", __name__, url_prefix="/api/hooks")

HOOK_EVENTS = ("PreToolUse", "PostToolUse", "Stop", "Notification")


def _project_root(project_id: str) -> Path:
    return Path(decode_project_dir(project_id))


def _read(project_id: str | None) -> dict:
    return read_project(_project_root(project_id)) if project_id else read_global()


def _write(project_id: str | None, data: dict) -> None:
    if project_id:
        write_project(_project_root(project_id), data)
    else:
        write_global(data)


def _serialize_hooks(hooks_data: dict) -> list[dict]:
    entries = []
    for event in HOOK_EVENTS:
        for idx, entry in enumerate(hooks_data.get(event, [])):
            entries.append({
                "event": event,
                "index": idx,
                "matcher": entry.get("matcher", "*"),
                "hooks": entry.get("hooks", []),
            })
    return entries


@bp.get("")
def list_hooks():
    project_id = request.args.get("project")
    settings = _read(project_id)
    hooks_data = settings.get("hooks", {})
    result = {event: settings.get("hooks", {}).get(event, []) for event in HOOK_EVENTS}
    return jsonify(result)


@bp.post("/<event>")
def create_hook(event: str):
    if event not in HOOK_EVENTS:
        return jsonify({"error": f"Unknown event '{event}'"}), 400
    body = request.get_json(silent=True) or {}
    matcher = body.get("matcher", "*")
    command = body.get("command", "")
    project_id = body.get("projectId")

    if not command:
        return jsonify({"error": "command required"}), 400

    entry = {"matcher": matcher, "hooks": [{"type": "command", "command": command}]}
    settings = _read(project_id)
    settings.setdefault("hooks", {}).setdefault(event, []).append(entry)
    _write(project_id, settings)
    return jsonify({"event": event, "created": True}), 201


@bp.put("/<event>/<int:index>")
def update_hook(event: str, index: int):
    if event not in HOOK_EVENTS:
        return jsonify({"error": f"Unknown event '{event}'"}), 400
    body = request.get_json(silent=True) or {}
    project_id = request.args.get("project") or body.get("projectId")

    settings = _read(project_id)
    entries = settings.get("hooks", {}).get(event, [])
    if index >= len(entries):
        return jsonify({"error": "Index out of range"}), 404

    if "matcher" in body:
        entries[index]["matcher"] = body["matcher"]
    if "command" in body:
        entries[index]["hooks"] = [{"type": "command", "command": body["command"]}]
    settings.setdefault("hooks", {})[event] = entries
    _write(project_id, settings)
    return jsonify({"updated": True})


@bp.delete("/<event>/<int:index>")
def delete_hook(event: str, index: int):
    if event not in HOOK_EVENTS:
        return jsonify({"error": f"Unknown event '{event}'"}), 400
    project_id = request.args.get("project")

    settings = _read(project_id)
    entries = settings.get("hooks", {}).get(event, [])
    if index >= len(entries):
        return jsonify({"error": "Index out of range"}), 404

    entries.pop(index)
    settings.setdefault("hooks", {})[event] = entries
    _write(project_id, settings)
    return jsonify({"deleted": True})


@bp.post("/<event>/<int:index>/promote")
def promote_hook(event: str, index: int):
    if event not in HOOK_EVENTS:
        return jsonify({"error": f"Unknown event '{event}'"}), 400
    body = request.get_json(silent=True) or {}
    from_project = body.get("fromProject")
    if not from_project:
        return jsonify({"error": "fromProject required"}), 400

    proj_settings = read_project(_project_root(from_project))
    entries = proj_settings.get("hooks", {}).get(event, [])
    if index >= len(entries):
        return jsonify({"error": "Index out of range in project"}), 404

    entry = entries[index]
    global_settings = read_global()
    global_settings.setdefault("hooks", {}).setdefault(event, []).append(entry)
    write_global(global_settings)
    return jsonify({"promoted": True})


@bp.get("/codex")
def list_codex_hooks():
    hooks_dir = CODEX_DIR / "hooks"
    if not hooks_dir.is_dir():
        return jsonify({"hooks": [], "available": False})
    hooks = []
    for f in sorted(hooks_dir.iterdir()):
        if f.is_file():
            hooks.append({
                "name": f.name,
                "path": str(f),
                "size": f.stat().st_size,
                "mtime": f.stat().st_mtime,
            })
    return jsonify({"hooks": hooks, "available": True})


@bp.post("/install-plan-tracker")
def install_plan_tracker():
    _SENTINEL = "_managed_by"
    _SENTINEL_VAL = "ccc-plan-tracker"
    _TRACKED_EVENTS = ("PostToolUse", "Stop")
    _CMD = (
        "curl -s -X POST http://127.0.0.1:5050/api/plans/_event"
        " -H \"Content-Type: application/json\""
        " -H \"X-Requested-With: XMLHttpRequest\""
        " -d @- &"
    )

    settings = read_global()
    hooks = settings.setdefault("hooks", {})
    installed_events = []

    for event in _TRACKED_EVENTS:
        entries = hooks.setdefault(event, [])
        # Idempotency: check if our managed command already exists
        already_exists = any(
            any(h.get("command", "") == _CMD for h in entry.get("hooks", []))
            for entry in entries
        )
        if not already_exists:
            entries.append({
                "matcher": "*",
                _SENTINEL: _SENTINEL_VAL,
                "hooks": [{"type": "command", "command": _CMD}],
            })
            installed_events.append(event)

    write_global(settings)
    return jsonify({"installed": True, "events": installed_events or list(_TRACKED_EVENTS)})
