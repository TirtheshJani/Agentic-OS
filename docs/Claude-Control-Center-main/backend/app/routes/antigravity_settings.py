from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import antigravity_settings_service as settings

bp = Blueprint("antigravity_settings", __name__, url_prefix="/api/antigravity/settings")

@bp.get("")
def get_settings():
    return jsonify(settings.get_settings())

@bp.put("")
def update_settings():
    body = request.get_json(silent=True) or {}
    res = settings.update_settings(body)
    if res.get("success"):
        return jsonify(res.get("settings")), 200
    return jsonify(res), 500
