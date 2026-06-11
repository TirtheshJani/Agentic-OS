"""Scheduler routes — task CRUD, run-now, enable/disable, actions, run log."""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import builtin_actions, scheduler_service

bp = Blueprint("scheduler", __name__, url_prefix="/api/scheduler")


# ---------------------------------------------------------------------------
# Status + actions
# ---------------------------------------------------------------------------

@bp.get("/status")
def get_status():
    return jsonify(scheduler_service.get_status())


@bp.get("/actions")
def list_actions():
    return jsonify({"actions": builtin_actions.list_actions()})


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@bp.get("/tasks")
def list_tasks():
    tasks = scheduler_service.load_tasks()
    tasks.sort(key=lambda t: t.get("created_at") or "", reverse=True)
    return jsonify({"tasks": tasks})


@bp.post("/tasks")
def create_task():
    body = request.get_json(silent=True) or {}
    try:
        task = scheduler_service.create_task(
            name=body.get("name", ""),
            action=body.get("action", ""),
            cron=body.get("cron", ""),
            params=body.get("params") if isinstance(body.get("params"), dict) else {},
            enabled=bool(body.get("enabled", True)),
            quiet_guard=bool(body.get("quiet_guard", True)),
            description=body.get("description", ""),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(task), 201


@bp.get("/tasks/<task_id>")
def get_task(task_id: str):
    task = scheduler_service.get_task(task_id)
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


@bp.patch("/tasks/<task_id>")
def update_task(task_id: str):
    body = request.get_json(silent=True) or {}
    try:
        task = scheduler_service.update_task(task_id, body)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


@bp.delete("/tasks/<task_id>")
def delete_task(task_id: str):
    deleted = scheduler_service.delete_task(task_id)
    if not deleted:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"deleted": True})


@bp.post("/tasks/<task_id>/run")
def run_task(task_id: str):
    task = scheduler_service.run_now(task_id)
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"triggered": True, "task_id": task_id}), 202


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------

@bp.get("/runs")
def list_runs():
    task_id = request.args.get("task_id") or None
    try:
        limit = max(1, min(int(request.args.get("limit", 50)), 200))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid limit"}), 400
    return jsonify({"runs": scheduler_service.load_runs(task_id=task_id, limit=limit)})
