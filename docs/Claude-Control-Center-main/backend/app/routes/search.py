"""Global Search across Conversations and Memory. See search_service for the model."""
from flask import Blueprint, jsonify, request

from app.services import search_service

bp = Blueprint("search", __name__, url_prefix="/api/search")


@bp.get("")
def global_search():
    query = (request.args.get("q") or "").strip()
    if len(query) < 2:
        return jsonify({"conversations": [], "memory": []})
    return jsonify(search_service.search(query))
