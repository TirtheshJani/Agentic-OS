from flask import Blueprint, jsonify, request

from app.services import plan_progress_service, plan_archive_service, plan_event_queue
from app.services import plans_service

bp = Blueprint("plans", __name__, url_prefix="/api/plans")


@bp.get("")
def list_plans():
    return jsonify(plans_service.list_plans())


@bp.get("/<slug>")
def get_plan(slug: str):
    try:
        return jsonify(plans_service.get_plan(slug))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404


# ---------------------------------------------------------------------------
# Progress / steps / archive / pin / event / archived
# ---------------------------------------------------------------------------

@bp.get("/archived")
def list_archived():
    return jsonify(plan_archive_service.list_archived())


@bp.get("/<slug>/progress")
def get_progress(slug: str):
    try:
        return jsonify(plans_service.get_progress(slug))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@bp.post("/<slug>/steps/<int:step_id>/toggle")
def toggle_step(slug: str, step_id: int):
    body = request.get_json(silent=True) or {}
    checked = bool(body.get("checked", False))
    evidence = body.get("evidence")
    step = plan_progress_service.toggle_step(slug, step_id, checked, evidence)
    return jsonify({"slug": slug, "step": step})


@bp.post("/<slug>/archive")
def archive_plan(slug: str):
    try:
        new_path = plan_archive_service.archive(slug)
        return jsonify({"archived": True, "path": str(new_path)})
    except FileNotFoundError:
        return jsonify({"error": "Plan not found"}), 404
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@bp.post("/<slug>/pin")
def pin_plan(slug: str):
    body = request.get_json(silent=True) or {}
    session_id = body.get("session_id", "").strip()
    if not session_id:
        return jsonify({"error": "session_id required"}), 400
    plan_progress_service.pin_session(slug, session_id)
    return jsonify({"pinned": True, "slug": slug, "session_id": session_id})


@bp.post("/_event")
def ingest_event():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "expected JSON object"}), 400
    plan_event_queue.append(body)
    return jsonify({"queued": True}), 202
