from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import antigravity_session_scanner as scanner

bp = Blueprint("antigravity_sessions", __name__, url_prefix="/api/antigravity/sessions")

def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    lowered = value.strip().lower()
    if lowered in ("1", "true", "yes", "on"):
        return True
    if lowered in ("0", "false", "no", "off"):
        return False
    return None

@bp.get("")
def list_sessions():
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid pagination parameters"}), 400

    page = max(1, page)
    limit = max(1, min(limit, 200))

    project_filter = request.args.get("project", "").strip()
    search = request.args.get("search", "").strip().lower()
    sort_by = request.args.get("sort", "newest").strip().lower()

    sessions = scanner.get_sessions()

    if project_filter:
        sessions = [s for s in sessions if s.get("project") == project_filter]
    if search:
        sessions = [
            s for s in sessions
            if search in (s.get("task_text") or "").lower()
            or search in (s.get("project") or "").lower()
            or search in (s.get("session_id") or "").lower()
        ]

    if sort_by == "oldest":
        sessions = sorted(sessions, key=lambda s: s.get("first_ts") or "")
    elif sort_by == "duration":
        sessions = sorted(sessions, key=lambda s: s.get("duration_seconds") or 0, reverse=True)
    elif sort_by == "tools":
        sessions = sorted(sessions, key=lambda s: s.get("total_tool_calls") or 0, reverse=True)
    elif sort_by == "turns":
        sessions = sorted(sessions, key=lambda s: (s.get("user_turn_count") or 0) + (s.get("agent_turn_count") or 0), reverse=True)
    else:
        sessions = sorted(sessions, key=lambda s: s.get("first_ts") or "", reverse=True)

    total = len(sessions)
    offset = (page - 1) * limit
    items = sessions[offset:offset + limit]

    return jsonify({"total": total, "page": page, "limit": limit, "items": items})

@bp.get("/stats")
def get_stats():
    days_param = request.args.get("days", "30")
    days = None if days_param == "all" else int(days_param)
    sessions = scanner.get_sessions()
    stats = scanner.get_stats(sessions, days)
    return jsonify(stats)

@bp.post("/scan")
def trigger_scan():
    result = scanner.trigger_scan()
    return jsonify(result)

@bp.get("/<session_id>")
def get_session(session_id: str):
    sessions = scanner.get_sessions()
    summary = next((s for s in sessions if s.get("session_id") == session_id), None)
    if not summary:
        return jsonify({"error": "not found"}), 404
    events = scanner.get_session_events(session_id)
    return jsonify({"summary": summary, "events": events})
