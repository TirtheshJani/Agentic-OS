from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import gemini_session_scanner as scanner

bp = Blueprint("gemini_analytics", __name__, url_prefix="/api/gemini/analytics")


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
