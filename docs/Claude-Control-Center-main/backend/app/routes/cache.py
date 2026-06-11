from flask import Blueprint, jsonify, request

from app.services import cache_service

bp = Blueprint("cache", __name__, url_prefix="/api/cache")


@bp.get("/stats")
def get_cache_stats():
    days_param = request.args.get("days", "30")
    try:
        days = None if days_param == "all" else int(days_param)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid days parameter"}), 400
    return jsonify(cache_service.build_cache_stats(days=days))


@bp.get("/session")
def get_session_cache():
    project_dir = request.args.get("project_dir", "")
    session_id = request.args.get("session_id", "")
    if not project_dir or not session_id:
        return jsonify({"error": "project_dir and session_id required"}), 400
    result = cache_service.get_session_cache_stats(project_dir, session_id)
    if result is None:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(result)
