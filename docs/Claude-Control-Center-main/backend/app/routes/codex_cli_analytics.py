from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import codex_cli_session_scanner as scanner

bp = Blueprint("codex_cli_analytics", __name__, url_prefix="/api/codex-cli/analytics")


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
