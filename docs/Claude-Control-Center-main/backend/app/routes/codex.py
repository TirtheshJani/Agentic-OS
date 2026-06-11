from flask import Blueprint, jsonify, request

from app.services import codex_tracker

bp = Blueprint("codex", __name__, url_prefix="/api/codex")


@bp.get("/usages")
def list_usages():
    records = codex_tracker.load()

    project_filter = request.args.get("project")
    session_filter = request.args.get("session")
    if project_filter:
        records = [r for r in records if r.get("project") == project_filter or r.get("project_dir") == project_filter]
    if session_filter:
        records = [r for r in records if r.get("session_id") == session_filter]

    try:
        limit = int(request.args.get("limit", 50))
        page = int(request.args.get("page", 1))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid parameter"}), 400
    offset = (page - 1) * limit

    total = len(records)
    page_items = records[offset: offset + limit]
    return jsonify({"total": total, "page": page, "limit": limit, "items": page_items})


@bp.get("/stats")
def get_stats():
    records = codex_tracker.load()
    return jsonify(codex_tracker.build_stats(records))


@bp.post("/scan")
def trigger_scan():
    records = codex_tracker.scan_all()
    return jsonify({
        "scanned": len(records),
        "stats": codex_tracker.build_stats(records),
    })
