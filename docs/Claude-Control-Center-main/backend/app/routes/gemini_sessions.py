from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import gemini_session_scanner as scanner

bp = Blueprint("gemini_sessions", __name__, url_prefix="/api/gemini/sessions")


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

    model_filter = request.args.get("model", "").strip()
    project_filter = request.args.get("project", "").strip()
    search = request.args.get("search", "").strip().lower()
    sort_by = request.args.get("sort", "newest").strip().lower()
    starred_param = _parse_bool(request.args.get("starred"))
    include_archived = _parse_bool(request.args.get("include_archived")) or False
    try:
        min_tools = int(request.args.get("min_tools", 0))
    except (TypeError, ValueError):
        min_tools = 0

    sessions = scanner.get_sessions()

    if model_filter:
        sessions = [s for s in sessions if s.get("model") == model_filter]
    if project_filter:
        sessions = [s for s in sessions if s.get("project") == project_filter]
    if not include_archived:
        sessions = [s for s in sessions if not s.get("archived")]
    if starred_param is True:
        sessions = [s for s in sessions if s.get("starred")]
    if min_tools > 0:
        sessions = [s for s in sessions if (s.get("total_tool_calls") or 0) >= min_tools]
    if search:
        sessions = [
            s for s in sessions
            if search in (s.get("task_text") or "").lower()
            or search in (s.get("project") or "").lower()
            or search in (s.get("session_id") or "").lower()
            or search in (s.get("note") or "").lower()
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
