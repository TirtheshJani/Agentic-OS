from flask import Blueprint, jsonify, request

from app.services import goal_service

bp = Blueprint("goals", __name__, url_prefix="/api/goals")


@bp.get("")
def list_all_goals():
    sessions = goal_service.get_all_sessions_with_goals()
    return jsonify({"sessions": sessions})


@bp.get("/<project_id>/<session_id>")
def get_session_goals(project_id: str, session_id: str):
    goals = goal_service.get_session_goals(project_id, session_id)
    return jsonify({"goals": goals})


@bp.post("/<project_id>/<session_id>/<goal_id>/milestones")
def create_milestone(project_id: str, session_id: str, goal_id: str):
    body = request.get_json(silent=True) or {}
    text = (body.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    milestone = goal_service.add_milestone(project_id, session_id, goal_id, text)
    return jsonify(milestone), 201


@bp.patch("/<project_id>/<session_id>/<goal_id>/milestones/<milestone_id>")
def toggle_milestone(project_id: str, session_id: str, goal_id: str, milestone_id: str):
    result = goal_service.toggle_milestone(project_id, session_id, goal_id, milestone_id)
    if result is None:
        return jsonify({"error": "Milestone not found"}), 404
    return jsonify(result)


@bp.delete("/<project_id>/<session_id>/<goal_id>/milestones/<milestone_id>")
def delete_milestone(project_id: str, session_id: str, goal_id: str, milestone_id: str):
    ok = goal_service.delete_milestone(project_id, session_id, goal_id, milestone_id)
    if not ok:
        return jsonify({"error": "Milestone not found"}), 404
    return jsonify({"deleted": True})
