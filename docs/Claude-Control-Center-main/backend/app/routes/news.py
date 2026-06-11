from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import news_service

bp = Blueprint("news", __name__, url_prefix="/api/news")


@bp.get("/feed")
def get_feed():
    return jsonify(news_service.load_feed())


@bp.post("/refresh")
def refresh():
    return jsonify(news_service.refresh_feed())


@bp.get("/ideas")
def get_ideas():
    return jsonify(news_service.load_ideas())


@bp.post("/ideas/generate")
def generate_ideas():
    body = request.get_json(silent=True) or {}
    kinds = body.get("kinds", ["video", "learning"])
    try:
        return jsonify(news_service.generate_ideas(kinds))
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 400


@bp.post("/ideas/export")
def export_idea():
    body = request.get_json(silent=True) or {}
    vault_id = (body.get("vault_id") or "").strip()
    idea = body.get("idea")
    if not vault_id or not isinstance(idea, dict):
        return jsonify({"error": "vault_id and idea are required"}), 400
    try:
        result = news_service.export_idea_to_vault(vault_id, idea)
        return jsonify({"exported": True, "note": result})
    except (ValueError, FileNotFoundError) as exc:
        return jsonify({"error": str(exc)}), 404


@bp.get("/sources/status")
def sources_status():
    return jsonify(news_service.sources_status())
