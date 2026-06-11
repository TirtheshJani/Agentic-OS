from __future__ import annotations

import subprocess
from pathlib import Path

import orjson
from flask import Blueprint, Response, jsonify, request, stream_with_context

from app.config import PORT
from app.services import gws_audit, gws_activity_scanner, gws_bridge_service, gws_service, gws_snapshot_service

bp = Blueprint("gws", __name__, url_prefix="/api/gws")

_RECIPES_FILE = Path(__file__).parent.parent.parent / "data" / "gws_recipes.json"

_BUILTIN_IDS: frozenset[str] = frozenset({
    "standup-report", "weekly-digest", "meeting-prep", "email-to-task", "triage-inbox",
})

# Fallback seed used when gws_recipes.json is missing (e.g. fresh Docker volume)
_DEFAULT_RECIPES: list[dict] = [
    {"id": "standup-report", "name": "Morning Standup",  "description": "Daily standup report from Gmail + Calendar", "args": ["workflow", "+standup-report"], "streaming": True,  "builtin": True, "enabled": True, "requires_input": []},
    {"id": "weekly-digest",  "name": "Weekly Digest",    "description": "Summary of the week across Gmail and Calendar", "args": ["workflow", "+weekly-digest"],  "streaming": True,  "builtin": True, "enabled": True, "requires_input": []},
    {"id": "meeting-prep",   "name": "Meeting Prep",     "description": "Briefing doc for next calendar event",        "args": ["workflow", "+meeting-prep"],   "streaming": True,  "builtin": True, "enabled": True, "requires_input": []},
    {"id": "email-to-task",  "name": "Email → Task",     "description": "Convert an email thread into a Tasks item",   "args": ["workflow", "+email-to-task"],  "streaming": True,  "builtin": True, "enabled": True,
     "requires_input": [{"key": "message_id", "label": "Message ID", "flag": "--message-id"}]},
    {"id": "triage-inbox",   "name": "Triage Inbox",     "description": "Label and reply to unread Gmail messages",    "args": ["gmail", "+triage"],            "streaming": False, "builtin": True, "enabled": True, "requires_input": []},
]


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

@bp.get("/status")
def get_status():
    gws_bin = gws_service.resolve_binary()
    if gws_bin is None:
        return jsonify({"binary_found": False, "binary_path": None, "version": None, "port": PORT})

    try:
        result = subprocess.run(
            [str(gws_bin), "--version"],
            capture_output=True, text=True, timeout=5,
            env=gws_service._build_env(),
        )
        version = (result.stdout or result.stderr).strip().splitlines()[0] if result.returncode == 0 else None
    except Exception:
        version = None

    return jsonify({"binary_found": True, "binary_path": str(gws_bin), "version": version, "port": PORT})


# ---------------------------------------------------------------------------
# Execute (sync)
# ---------------------------------------------------------------------------

@bp.post("/execute")
def execute():
    data = request.get_json(silent=True) or {}
    args = data.get("args")
    if not isinstance(args, list) or not all(isinstance(a, str) for a in args):
        return jsonify({"error": "args must be a list of strings"}), 400

    source = data.get("source", "manual")
    timeout = min(int(data.get("timeout", 30)), 120)

    try:
        result = gws_service.run_command(args, timeout=timeout, source=source)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Command timed out"}), 504
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 429

    return jsonify(result)


# ---------------------------------------------------------------------------
# Execute (streaming SSE)
# ---------------------------------------------------------------------------

@bp.get("/execute/stream")
def execute_stream():
    args = request.args.getlist("args")
    if not args:
        return jsonify({"error": "args query parameter required"}), 400

    source = request.args.get("source", "manual")

    try:
        gws_service.validate_args(args)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if gws_service.resolve_binary() is None:
        return jsonify({"error": "gws binary not found"}), 503

    def generate():
        try:
            yield from gws_service.stream_command(args, source=source)
        except Exception as exc:
            yield f"data: [error] {exc}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@bp.get("/audit")
def get_audit():
    try:
        limit = int(request.args.get("limit", 200))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid limit"}), 400
    return jsonify(gws_audit.load(limit=limit))


@bp.delete("/audit")
def clear_audit():
    gws_audit.clear()
    return jsonify({"cleared": True})


# ---------------------------------------------------------------------------
# Recipes
# ---------------------------------------------------------------------------

def _load_recipes() -> list[dict]:
    if not _RECIPES_FILE.exists():
        # Seed from defaults on first run (fresh volume / missing file)
        _save_recipes(_DEFAULT_RECIPES)
        return list(_DEFAULT_RECIPES)
    try:
        return orjson.loads(_RECIPES_FILE.read_bytes())
    except Exception:
        return list(_DEFAULT_RECIPES)


def _save_recipes(recipes: list[dict]) -> None:
    _RECIPES_FILE.parent.mkdir(parents=True, exist_ok=True)
    _RECIPES_FILE.write_bytes(orjson.dumps(recipes, option=orjson.OPT_INDENT_2))


@bp.get("/recipes")
def list_recipes():
    return jsonify(_load_recipes())


@bp.post("/recipes")
def create_recipe():
    data = request.get_json(silent=True) or {}
    required = {"id", "name", "args"}
    missing = required - data.keys()
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400
    if data["id"] in _BUILTIN_IDS:
        return jsonify({"error": "Cannot create recipe with a built-in ID"}), 400

    recipes = _load_recipes()
    if any(r["id"] == data["id"] for r in recipes):
        return jsonify({"error": "Recipe ID already exists"}), 409

    recipe = {
        "id": data["id"],
        "name": data["name"],
        "description": data.get("description", ""),
        "args": data["args"],
        "streaming": bool(data.get("streaming", False)),
        "builtin": False,
        "enabled": True,
        "requires_input": data.get("requires_input", []),
    }
    recipes.append(recipe)
    _save_recipes(recipes)
    return jsonify(recipe), 201


@bp.put("/recipes/<recipe_id>")
def update_recipe(recipe_id: str):
    data = request.get_json(silent=True) or {}
    recipes = _load_recipes()
    for i, r in enumerate(recipes):
        if r["id"] == recipe_id:
            if r.get("builtin") and recipe_id in _BUILTIN_IDS:
                # Allow toggling enabled on built-ins, nothing else
                if set(data.keys()) - {"enabled"}:
                    return jsonify({"error": "Built-in recipes can only have 'enabled' changed"}), 403
            recipes[i] = {**r, **{k: v for k, v in data.items() if k != "builtin"}}
            _save_recipes(recipes)
            return jsonify(recipes[i])
    return jsonify({"error": "Recipe not found"}), 404


# ---------------------------------------------------------------------------
# Snapshot (dashboard data cache)
# ---------------------------------------------------------------------------

@bp.get("/snapshot")
def get_snapshot():
    return jsonify(gws_snapshot_service.load())


@bp.post("/snapshot/refresh")
def trigger_snapshot_refresh():
    if gws_service.resolve_binary() is None:
        return jsonify({"error": "gws binary not found"}), 503
    snapshot = gws_snapshot_service.refresh()
    return jsonify(snapshot)


@bp.get("/inbox")
def get_inbox():
    return jsonify(gws_snapshot_service.load().get("inbox", {}))


@bp.get("/agenda")
def get_agenda():
    return jsonify(gws_snapshot_service.load().get("agenda", {}))


@bp.get("/tasks")
def get_tasks():
    return jsonify(gws_snapshot_service.load().get("tasks", {}))


@bp.get("/drive/recent")
def get_drive_recent():
    return jsonify(gws_snapshot_service.load().get("drive", {}))


# ---------------------------------------------------------------------------
# Recipes
# ---------------------------------------------------------------------------

@bp.delete("/recipes/<recipe_id>")
def delete_recipe(recipe_id: str):
    if recipe_id in _BUILTIN_IDS:
        return jsonify({"error": "Cannot delete built-in recipes"}), 403
    recipes = _load_recipes()
    updated = [r for r in recipes if r["id"] != recipe_id]
    if len(updated) == len(recipes):
        return jsonify({"error": "Recipe not found"}), 404
    _save_recipes(updated)
    return jsonify({"deleted": recipe_id})


@bp.post("/recipes/<recipe_id>/run")
def run_recipe(recipe_id: str):
    recipes = _load_recipes()
    recipe = next((r for r in recipes if r["id"] == recipe_id), None)
    if recipe is None:
        return jsonify({"error": "Recipe not found"}), 404
    if not recipe.get("enabled", True):
        return jsonify({"error": "Recipe is disabled"}), 403

    inputs = (request.get_json(silent=True) or {}).get("inputs", {})
    args = list(recipe["args"])

    for field in recipe.get("requires_input", []):
        key = field["key"]
        flag = field["flag"]
        value = inputs.get(key)
        if not value:
            return jsonify({"error": f"Missing required input: {field['label']} ({key})"}), 400
        args += [flag, value]

    if recipe.get("streaming"):
        stream_args = "&".join(f"args={a}" for a in args)
        return jsonify({"streaming": True, "stream_url": f"/api/gws/execute/stream?{stream_args}&source=recipe"})

    try:
        result = gws_service.run_command(args, source="recipe")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Command timed out"}), 504
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 429

    return jsonify(result)


# ---------------------------------------------------------------------------
# Codex Skill Bridge (Phase 5)
# ---------------------------------------------------------------------------

@bp.get("/codex-bridge")
def get_codex_bridge():
    return jsonify(gws_bridge_service.status())


@bp.post("/codex-bridge")
def install_codex_bridge():
    result = gws_bridge_service.install()
    return jsonify(result), 201


@bp.delete("/codex-bridge")
def uninstall_codex_bridge():
    result = gws_bridge_service.uninstall()
    if not result.get("uninstalled") and "reason" in result:
        return jsonify(result), 409
    return jsonify(result)


# ---------------------------------------------------------------------------
# Unified Activity Log (Phase 6)
# ---------------------------------------------------------------------------

@bp.get("/activity")
def get_activity():
    try:
        limit = int(request.args.get("limit", 100))
        page = int(request.args.get("page", 1))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid pagination params"}), 400

    source_filter = request.args.get("source")
    service_filter = request.args.get("service")

    data = gws_activity_scanner.load()
    records = data.get("records", [])

    if source_filter:
        records = [r for r in records if r.get("source") == source_filter]
    if service_filter:
        records = [r for r in records if r.get("service") == service_filter]

    total = len(records)
    start = (page - 1) * limit
    page_records = records[start: start + limit]

    return jsonify({
        "scanned_at": data.get("scanned_at"),
        "total": total,
        "page": page,
        "limit": limit,
        "records": page_records,
    })


@bp.post("/activity/scan")
def trigger_activity_scan():
    records = gws_activity_scanner.scan()
    return jsonify({"scanned": len(records)})
