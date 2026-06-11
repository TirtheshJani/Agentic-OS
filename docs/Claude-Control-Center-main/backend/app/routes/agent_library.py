from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import agent_library_service as svc
from app.services import skill_installer as installer

bp = Blueprint("agent_library", __name__, url_prefix="/api/agent-library")


@bp.get("")
def list_agents():
    return jsonify(svc.list_agents())


@bp.post("")
def create_agent():
    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return jsonify({"error": "name is required"}), 400
    agent = svc.create_agent(data)
    return jsonify(agent), 201


@bp.get("/<agent_id>")
def get_agent(agent_id: str):
    agent = svc.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(agent)


@bp.put("/<agent_id>")
def update_agent(agent_id: str):
    data = request.get_json(silent=True) or {}
    agent = svc.update_agent(agent_id, data)
    if agent is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(agent)


@bp.delete("/<agent_id>")
def delete_agent(agent_id: str):
    agent = svc.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "not found"}), 404
    slug = agent.get("slug", "")
    installer.uninstall_skill(slug)
    installer.uninstall_subagent(slug)
    svc.delete_agent(agent_id)
    return jsonify({"ok": True})


@bp.post("/<agent_id>/install")
def install_agent(agent_id: str):
    agent = svc.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "not found"}), 404

    targets = agent.get("install_targets", ["skill", "subagent"])
    installed = []
    errors = []

    if "skill" in targets:
        try:
            installer.install_skill(agent)
            installed.append("skill")
        except Exception as e:
            errors.append(f"skill: {e}")

    if "subagent" in targets:
        try:
            installer.install_subagent(agent)
            installed.append("subagent")
        except Exception as e:
            errors.append(f"subagent: {e}")

    if "memory" in agent.get("capabilities", []):
        try:
            installer.install_memory(agent)
        except Exception as e:
            errors.append(f"memory: {e}")

    refreshed = svc.get_agent(agent_id)
    if errors:
        return jsonify({"ok": False, "installed": installed, "errors": errors, "agent": refreshed}), 207
    return jsonify({"ok": True, "installed": installed, "agent": refreshed})


@bp.post("/<agent_id>/uninstall")
def uninstall_agent(agent_id: str):
    agent = svc.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "not found"}), 404

    slug = agent.get("slug", "")
    installer.uninstall_skill(slug)
    installer.uninstall_subagent(slug)

    refreshed = svc.get_agent(agent_id)
    return jsonify({"ok": True, "agent": refreshed})


@bp.get("/<agent_id>/preview")
def preview_agent(agent_id: str):
    agent = svc.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "skill_md": installer.generate_skill_md(agent),
        "subagent_md": installer.generate_subagent_md(agent),
    })


@bp.get("/<agent_id>/memory")
def get_agent_memory(agent_id: str):
    agent = svc.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "not found"}), 404
    content = installer.read_memory(agent.get("slug", ""))
    return jsonify({"content": content})
