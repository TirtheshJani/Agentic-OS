import os
from pathlib import Path
from flask import Blueprint, jsonify, request
import orjson

from app.config import CLAUDE_DIR
from app.services.settings_io import read_global, write_global, read_project, write_project
from app.services.project_decoder import decode_project_dir

bp = Blueprint("mcp_servers", __name__, url_prefix="/api/mcp-servers")

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_TOOL_COUNTS_PATH = _DATA_DIR / "mcp_tool_counts.json"


def _load_tool_count_cache() -> dict:
    if not _TOOL_COUNTS_PATH.exists():
        return {}
    try:
        return orjson.loads(_TOOL_COUNTS_PATH.read_bytes())
    except Exception:
        return {}

HOOK_EVENTS = ("PreToolUse", "PostToolUse", "Stop", "Notification")


def _project_root(project_id: str) -> Path:
    return Path(decode_project_dir(project_id))


def _read(project_id: str | None) -> dict:
    if project_id:
        return read_project(_project_root(project_id))
    return read_global()


def _write(project_id: str | None, data: dict) -> None:
    if project_id:
        write_project(_project_root(project_id), data)
    else:
        write_global(data)


@bp.get("")
def list_servers():
    project_id = request.args.get("project")
    settings = _read(project_id)
    servers = settings.get("mcpServers", {})
    cache = _load_tool_count_cache()
    result = []
    for k, v in servers.items():
        tools_list = v.get("tools")
        if isinstance(tools_list, list):
            tool_count = len(tools_list)
        else:
            cached = cache.get(k)
            tool_count = cached if isinstance(cached, int) else None
        result.append({"name": k, **v, "toolCount": tool_count})
    return jsonify(result)


@bp.get("/refresh-tool-counts")
def refresh_tool_counts():
    settings = read_global()
    server_names = list(settings.get("mcpServers", {}).keys())
    counts: dict[str, int] = {}

    projects_dir = CLAUDE_DIR / "projects"
    if projects_dir.is_dir():
        for jf in projects_dir.rglob("*.jsonl"):
            try:
                for line in jf.read_bytes().splitlines():
                    if not line.strip():
                        continue
                    try:
                        obj = orjson.loads(line)
                    except Exception:
                        continue
                    msg = obj.get("message", obj)
                    if msg.get("type") != "assistant":
                        continue
                    content = msg.get("content", [])
                    if not isinstance(content, list):
                        continue
                    for block in content:
                        if not isinstance(block, dict) or block.get("type") != "tool_use":
                            continue
                        tool_name = block.get("name", "")
                        matched = False
                        for sname in server_names:
                            if tool_name.startswith(sname + "_") or tool_name.startswith(sname + ":"):
                                counts[sname] = counts.get(sname, 0) + 1
                                matched = True
                                break
                        if not matched:
                            counts["__global__"] = counts.get("__global__", 0) + 1
            except Exception:
                continue

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _TOOL_COUNTS_PATH.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(counts, option=orjson.OPT_INDENT_2))
    os.replace(tmp, _TOOL_COUNTS_PATH)
    return jsonify({"refreshed": True, "counts": counts})


@bp.post("")
def create_server():
    body = request.get_json(silent=True) or {}
    name = (body.pop("name", "") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    project_id = body.pop("projectId", None)

    settings = _read(project_id)
    servers = settings.setdefault("mcpServers", {})
    if name in servers:
        return jsonify({"error": f"Server '{name}' already exists"}), 409
    servers[name] = body
    _write(project_id, settings)
    return jsonify({"name": name, "created": True}), 201


@bp.put("/<name>")
def update_server(name: str):
    body = request.get_json(silent=True) or {}
    project_id = request.args.get("project") or body.pop("projectId", None)

    settings = _read(project_id)
    servers = settings.setdefault("mcpServers", {})
    if name not in servers:
        return jsonify({"error": "Not found"}), 404
    servers[name] = {k: v for k, v in body.items() if k not in ("name", "projectId")}
    _write(project_id, settings)
    return jsonify({"name": name, "updated": True})


@bp.delete("/<name>")
def delete_server(name: str):
    project_id = request.args.get("project")
    settings = _read(project_id)
    servers = settings.get("mcpServers", {})
    if name not in servers:
        return jsonify({"error": "Not found"}), 404
    del servers[name]
    settings["mcpServers"] = servers
    _write(project_id, settings)
    return jsonify({"deleted": True})


@bp.post("/<name>/promote")
def promote_server(name: str):
    body = request.get_json(silent=True) or {}
    from_project = body.get("fromProject")
    if not from_project:
        return jsonify({"error": "fromProject required"}), 400

    proj_settings = read_project(_project_root(from_project))
    proj_servers = proj_settings.get("mcpServers", {})
    if name not in proj_servers:
        return jsonify({"error": "Server not found in project"}), 404

    global_settings = read_global()
    global_settings.setdefault("mcpServers", {})[name] = proj_servers[name]
    write_global(global_settings)
    return jsonify({"promoted": True, "name": name})
