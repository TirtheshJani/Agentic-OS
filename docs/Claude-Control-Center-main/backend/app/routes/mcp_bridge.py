from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import mcp_install_service

bp = Blueprint("mcp_bridge", __name__, url_prefix="/api/mcp-bridge")


@bp.get("/status")
def get_status():
    return jsonify(mcp_install_service.status())


@bp.post("/install/<agent>")
def install_agent(agent: str):
    try:
        result = mcp_install_service.install(agent)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    status_code = 200 if result.get("installed") else 409
    return jsonify(result), status_code


@bp.post("/uninstall/<agent>")
def uninstall_agent(agent: str):
    try:
        result = mcp_install_service.uninstall(agent)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify(result)
