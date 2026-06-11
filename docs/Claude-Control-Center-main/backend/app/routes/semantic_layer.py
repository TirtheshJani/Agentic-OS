"""Semantic-layer API — governed metric catalog + query endpoint.

Thin blueprint: parse params, delegate to ``semantic_layer`` service, return
JSON. No business logic here (see CLAUDE.md route-layer convention).
"""
from flask import Blueprint, jsonify, request

from app.services import semantic_layer

bp = Blueprint("semantic_layer", __name__, url_prefix="/api/semantic")


@bp.get("/catalog")
def get_catalog():
    """Return the governed metric + dimension catalog (the 'sources of truth')."""
    return jsonify(semantic_layer.catalog())


@bp.get("/query")
def run_query():
    """Resolve metric × dimension × window × filters against cached summaries."""
    metric = request.args.get("metric")
    if not metric:
        return jsonify({"error": "metric is required"}), 400

    group_by = request.args.get("group_by") or None

    days_param = request.args.get("days", "30")
    try:
        days = None if days_param == "all" else int(days_param)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid days parameter"}), 400

    limit_param = request.args.get("limit")
    try:
        limit = int(limit_param) if limit_param is not None else 50
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid limit parameter"}), 400

    # Any remaining query params (minus the reserved ones) are dimension filters.
    reserved = {"metric", "group_by", "days", "limit"}
    filters = {k: v for k, v in request.args.items() if k not in reserved}

    try:
        result = semantic_layer.query(
            metric, group_by=group_by, days=days, filters=filters, limit=limit
        )
    except KeyError as exc:
        return jsonify({"error": exc.args[0] if exc.args else "unknown key"}), 400

    return jsonify(result)
