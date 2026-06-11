from __future__ import annotations

from flask import Blueprint, jsonify

from app.services import antigravity_memory_service as memory

bp = Blueprint("antigravity_memory", __name__, url_prefix="/api/antigravity/memory")

@bp.get("")
def list_memory():
    return jsonify({"items": memory.list_memory_files()})
