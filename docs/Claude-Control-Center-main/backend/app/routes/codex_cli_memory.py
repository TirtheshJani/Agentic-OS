from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import codex_cli_memory_reader as reader

bp = Blueprint("codex_cli_memory", __name__, url_prefix="/api/codex-cli/memory")


@bp.get("/history")
def get_history():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 50))
    search = request.args.get("search", "").strip()
    return jsonify(reader.read_history(limit=limit, page=page, search=search))


@bp.get("/session-index")
def get_session_index():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 50))
    return jsonify(reader.read_session_index(limit=limit, page=page))
