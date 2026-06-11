from __future__ import annotations

import orjson
from flask import Blueprint, jsonify, request

from app.config import CODEX_DIR
from app.services import codex_cli_session_meta as session_meta
from app.services import codex_cli_session_scanner as scanner

bp = Blueprint("codex_cli_sessions", __name__, url_prefix="/api/codex-cli/sessions")


def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    lowered = value.strip().lower()
    if lowered in ("1", "true", "yes", "on"):
        return True
    if lowered in ("0", "false", "no", "off"):
        return False
    return None


def _sort_sessions(sessions: list[dict], sort_by: str) -> list[dict]:
    if sort_by == "oldest":
        return sorted(sessions, key=lambda s: s.get("first_ts") or "")
    if sort_by == "duration":
        return sorted(sessions, key=lambda s: s.get("duration_seconds") or 0, reverse=True)
    if sort_by == "tools":
        return sorted(sessions, key=lambda s: s.get("total_tool_calls") or 0, reverse=True)
    if sort_by == "turns":
        return sorted(
            sessions,
            key=lambda s: (s.get("user_turn_count") or 0) + (s.get("agent_turn_count") or 0),
            reverse=True,
        )
    return sorted(sessions, key=lambda s: s.get("first_ts") or "", reverse=True)


@bp.get("")
def list_sessions():
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
        min_tools = int(request.args.get("min_tools", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid pagination/filter parameters"}), 400

    page = max(1, page)
    limit = max(1, min(limit, 200))
    min_tools = max(0, min_tools)

    project_filter = request.args.get("project", "").strip()
    model_filter = request.args.get("model", "").strip()
    source_filter = request.args.get("source", "").strip()
    search = request.args.get("search", "").strip().lower()
    sort_by = request.args.get("sort", "newest").strip().lower()
    starred = _parse_bool(request.args.get("starred"))
    include_archived = _parse_bool(request.args.get("include_archived"))

    meta_map = session_meta.load_all()
    sessions = [session_meta.merge(s, meta_map) for s in scanner.load()]

    if project_filter:
        sessions = [s for s in sessions if s.get("project") == project_filter]
    if model_filter:
        sessions = [s for s in sessions if s.get("model") == model_filter]
    if source_filter:
        sessions = [s for s in sessions if s.get("source") == source_filter]
    if min_tools > 0:
        sessions = [s for s in sessions if (s.get("total_tool_calls") or 0) >= min_tools]
    if starred is True:
        sessions = [s for s in sessions if s.get("starred") is True]
    if include_archived is not True:
        sessions = [s for s in sessions if s.get("archived") is not True]
    if search:
        sessions = [
            s for s in sessions
            if search in (s.get("task_text") or "").lower()
            or search in (s.get("project") or "").lower()
            or search in (s.get("note") or "").lower()
            or search in (s.get("session_id") or "").lower()
        ]

    sessions = _sort_sessions(sessions, sort_by)

    total = len(sessions)
    offset = (page - 1) * limit
    items = sessions[offset: offset + limit]

    return jsonify({"total": total, "page": page, "limit": limit, "items": items})


@bp.get("/stats")
def get_stats():
    days_param = request.args.get("days", "30")
    days = None if days_param == "all" else int(days_param)
    sessions = scanner.load()
    stats = scanner.build_stats(sessions, days)
    return jsonify(stats)


@bp.post("/scan")
def trigger_scan():
    sessions = scanner.scan_all()
    stats = scanner.build_stats(sessions)
    return jsonify({"scanned": len(sessions), "stats": stats})


@bp.get("/<session_id>")
def get_session(session_id: str):
    sessions = scanner.load()
    meta_map = session_meta.load_all()
    summary = next((session_meta.merge(s, meta_map) for s in sessions if s.get("session_id") == session_id), None)
    if not summary:
        return jsonify({"error": "not found"}), 404

    filepath = CODEX_DIR / summary["filepath"]
    if not filepath.exists():
        return jsonify({"summary": summary, "events": []})

    events = []
    try:
        with open(filepath, "rb") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = orjson.loads(line)
                except Exception:
                    continue

                etype = event.get("type")
                payload = event.get("payload") or {}

                if etype == "session_meta":
                    stripped = {k: v for k, v in payload.items() if k != "base_instructions"}
                    events.append({"timestamp": event.get("timestamp"), "type": etype, "payload": stripped})

                elif etype == "event_msg":
                    events.append({"timestamp": event.get("timestamp"), "type": etype, "payload": payload})

                elif etype == "response_item":
                    if payload.get("type") == "function_call":
                        args = payload.get("arguments") or ""
                        stripped_payload = {**payload, "arguments": args[:200] if isinstance(args, str) else str(args)[:200]}
                        events.append({"timestamp": event.get("timestamp"), "type": etype, "payload": stripped_payload})
                    elif payload.get("role") in ("user", "assistant"):
                        events.append({"timestamp": event.get("timestamp"), "type": etype, "payload": payload})

    except Exception as e:
        return jsonify({"summary": summary, "events": [], "error": str(e)})

    return jsonify({"summary": summary, "events": events})


@bp.patch("/<session_id>/meta")
def update_session_meta(session_id: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "expected JSON object body"}), 400

    allowed = {"starred", "archived", "note"}
    updates = {k: payload[k] for k in allowed if k in payload}
    if not updates:
        return jsonify({"error": "no supported fields provided"}), 400

    try:
        meta = session_meta.update(session_id, updates)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"session_id": session_id, "meta": meta})
