from __future__ import annotations

from flask import Blueprint, jsonify

from app.services import codex_cli_skills_reader as reader

bp = Blueprint("codex_cli_skills", __name__, url_prefix="/api/codex-cli/skills")


@bp.get("")
def list_skills():
    return jsonify(reader.list_skills())


@bp.get("/system")
def list_system_skills():
    return jsonify(reader.list_system_skills())


@bp.get("/<skill_id>")
def get_skill(skill_id: str):
    skill = reader.get_skill(skill_id)
    if not skill:
        return jsonify({"error": "not found"}), 404
    return jsonify(skill)


@bp.get("/<skill_id>/agent")
def get_skill_agent(skill_id: str):
    agent = reader.get_skill_agent(skill_id)
    if agent is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(agent)
