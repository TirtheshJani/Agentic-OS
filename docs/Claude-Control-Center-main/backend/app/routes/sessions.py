from flask import Blueprint, jsonify

from app.services.active_sessions_service import list_claude_sessions

bp = Blueprint("sessions", __name__, url_prefix="/api/active-sessions")


@bp.get("")
def list_active_sessions():
    return jsonify(list_claude_sessions())
