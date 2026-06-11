from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import antigravity_skills_service as skills

bp = Blueprint("antigravity_skills", __name__, url_prefix="/api/antigravity/skills")

@bp.get("")
def list_skills():
    return jsonify({"items": skills.list_skills()})

@bp.post("")
def add_skill():
    body = request.get_json(silent=True) or {}
    name = body.get("name")
    content = body.get("content")
    if not name or not content:
        return jsonify({"error": "Missing name or content"}), 400
    res = skills.add_skill(name, content)
    if res.get("success"):
        return jsonify(res), 201
    return jsonify(res), 500

@bp.delete("/<name>")
def delete_skill(name):
    res = skills.delete_skill(name)
    if res.get("success"):
        return jsonify(res), 200
    return jsonify(res), 404
