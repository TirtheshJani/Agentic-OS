from flask import Blueprint, jsonify, request
from app.services import analytics_service
from app.services import codeburn_service

bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@bp.get("/stats")
def get_stats():
    days_param = request.args.get("days", "30")
    try:
        days = None if days_param == "all" else int(days_param)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid parameter"}), 400
    summaries = analytics_service.load()
    return jsonify(analytics_service.build_stats(summaries, days=days))


@bp.post("/scan")
def trigger_scan():
    days_param = request.args.get("days", "30")
    try:
        days = None if days_param == "all" else int(days_param)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid parameter"}), 400
    summaries = analytics_service.scan_all()
    return jsonify({
        "scanned": len(summaries),
        "stats": analytics_service.build_stats(summaries, days=days),
    })


@bp.get("/codeburn")
def get_codeburn_stats():
    days_param = request.args.get("days", "30")
    try:
        days = None if days_param == "all" else int(days_param)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid parameter"}), 400
    summaries = analytics_service.load()
    return jsonify(codeburn_service.build_codeburn_stats(summaries, days=days))
