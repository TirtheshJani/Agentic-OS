from __future__ import annotations

from flask import Blueprint, jsonify

from app.services import gemini_bridge_service

bp = Blueprint("gemini_skills", __name__, url_prefix="/api/gemini/skills")


@bp.get("/")
def get_status():
    return jsonify(gemini_bridge_service.get_status())


@bp.post("/install")
def install_skill():
    result = gemini_bridge_service.install_skill()
    return jsonify(result), 201 if result.get("installed") else 500


@bp.delete("/uninstall")
def uninstall_skill():
    result = gemini_bridge_service.uninstall_skill()
    return jsonify(result)
