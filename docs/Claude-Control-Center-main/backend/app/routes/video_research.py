from __future__ import annotations

from flask import Blueprint, jsonify, request, send_file

from app.services import video_research_service

bp = Blueprint("video_research", __name__, url_prefix="/api/video-research")


@bp.get("/jobs")
def list_jobs():
    return jsonify(video_research_service.list_jobs())


@bp.post("/jobs")
def create_job():
    body = request.get_json(silent=True) or {}
    topic = (body.get("topic") or "").strip()
    mode = body.get("mode", "single-video")
    video_format = body.get("format", "long")
    vault_id = body.get("vault_id")

    if not topic:
        return jsonify({"error": "topic is required"}), 400

    try:
        job = video_research_service.create_job(
            topic=topic,
            mode=mode,
            video_format=video_format,
            vault_id=vault_id,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    video_research_service.trigger_job(job["id"])
    return jsonify(job), 202


@bp.get("/jobs/<job_id>")
def get_job(job_id: str):
    job = video_research_service.get_job(job_id)
    if job is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(job)


@bp.delete("/jobs/<job_id>")
def delete_job(job_id: str):
    deleted = video_research_service.delete_job(job_id)
    if not deleted:
        return jsonify({"error": "not found"}), 404
    return jsonify({"deleted": True})


@bp.post("/jobs/<job_id>/run")
def run_job(job_id: str):
    job = video_research_service.get_job(job_id)
    if job is None:
        return jsonify({"error": "not found"}), 404
    video_research_service.trigger_job(job_id)
    return jsonify({"triggered": True, "job_id": job_id})


@bp.post("/jobs/<job_id>/pick-angle")
def pick_angle(job_id: str):
    body = request.get_json(silent=True) or {}
    try:
        angle_index = int(body.get("angle_index"))
    except (TypeError, ValueError):
        return jsonify({"error": "angle_index (int) required"}), 400
    try:
        child = video_research_service.pick_angle(job_id, angle_index)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(child), 202


@bp.get("/jobs/<job_id>/log")
def get_job_log(job_id: str):
    job = video_research_service.get_job(job_id)
    if job is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"log": job.get("log", "")})


@bp.get("/jobs/<job_id>/deliverable/<name>")
def get_deliverable(job_id: str, name: str):
    job = video_research_service.get_job(job_id)
    if job is None:
        return jsonify({"error": "not found"}), 404
    path = video_research_service.get_deliverable_path(job, name)
    if path is None:
        return jsonify({"error": "deliverable not found"}), 404
    mime = "application/json" if name.endswith(".json") else "text/markdown"
    if request.args.get("raw") == "1":
        return send_file(path, mimetype=mime)
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"name": name, "content": text, "size": path.stat().st_size})


@bp.post("/jobs/<job_id>/sync-vault")
def sync_vault(job_id: str):
    body = request.get_json(silent=True) or {}
    vault_id = body.get("vault_id")
    try:
        result = video_research_service.sync_to_vault(job_id, vault_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(result)


@bp.get("/search")
def search():
    query = request.args.get("q", "")
    return jsonify(video_research_service.search_jobs(query))


@bp.get("/sources/status")
def sources_status():
    return jsonify(video_research_service.sources_status())
