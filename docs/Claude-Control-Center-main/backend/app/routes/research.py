from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import research_pipeline_service

bp = Blueprint("research", __name__, url_prefix="/api/research")


@bp.get("/jobs")
def list_jobs():
    return jsonify(research_pipeline_service.list_jobs())


@bp.post("/jobs")
def create_job():
    body = request.get_json(silent=True) or {}
    title = body.get("title", "").strip()
    query = body.get("query", "").strip()
    sources = body.get("sources", ["youtube", "reddit", "web"])
    subreddits = body.get("subreddits")
    max_results = int(body.get("max_results", 10))
    vault_id = body.get("vault_id")

    if not query:
        return jsonify({"error": "query is required"}), 400
    if not title:
        title = f"Research: {query}"

    valid_sources = {"youtube", "reddit", "web", "vault_pipeline"}
    sources = [s for s in sources if s in valid_sources]
    if not sources:
        return jsonify({"error": "at least one valid source required (youtube, reddit, web, vault_pipeline)"}), 400

    # vault_pipeline is mutually exclusive — it runs the full Claude skill pipeline
    if "vault_pipeline" in sources and len(sources) > 1:
        return jsonify({"error": "vault_pipeline cannot be combined with other sources"}), 400

    job = research_pipeline_service.create_job(
        title=title,
        query=query,
        sources=sources,
        subreddits=subreddits,
        max_results=max_results,
        vault_id=vault_id,
    )
    # Auto-trigger
    research_pipeline_service.trigger_job(job["id"])
    return jsonify(job), 202


@bp.get("/jobs/<job_id>")
def get_job(job_id: str):
    job = research_pipeline_service.get_job(job_id)
    if job is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(job)


@bp.delete("/jobs/<job_id>")
def delete_job(job_id: str):
    deleted = research_pipeline_service.delete_job(job_id)
    if not deleted:
        return jsonify({"error": "not found"}), 404
    return jsonify({"deleted": True})


@bp.post("/jobs/<job_id>/run")
def run_job(job_id: str):
    job = research_pipeline_service.get_job(job_id)
    if job is None:
        return jsonify({"error": "not found"}), 404
    research_pipeline_service.trigger_job(job_id)
    return jsonify({"triggered": True, "job_id": job_id})


@bp.post("/import-vault")
def import_from_vault():
    body = request.get_json(silent=True) or {}
    vault_id = body.get("vault_id", "").strip()
    if not vault_id:
        return jsonify({"error": "vault_id is required"}), 400
    try:
        created = research_pipeline_service.import_from_vault(vault_id)
        return jsonify({"imported": len(created), "jobs": created})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404


@bp.get("/jobs/<job_id>/log")
def get_job_log(job_id: str):
    job = research_pipeline_service.get_job(job_id)
    if job is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"log": job.get("log", "")})


@bp.get("/sources/status")
def sources_status():
    import os

    # YouTube
    try:
        import yt_dlp  # type: ignore  # noqa: F401
        yt_available = True
    except ImportError:
        yt_available = False

    # Reddit
    try:
        import praw  # type: ignore  # noqa: F401
        praw_installed = True
    except ImportError:
        praw_installed = False
    reddit_configured = bool(
        os.getenv("REDDIT_CLIENT_ID") and os.getenv("REDDIT_CLIENT_SECRET")
    )

    # Firecrawl
    try:
        from firecrawl import FirecrawlApp  # type: ignore  # noqa: F401
        firecrawl_installed = True
    except ImportError:
        firecrawl_installed = False
    firecrawl_configured = bool(os.getenv("FIRECRAWL_API_KEY"))

    # vault_pipeline — requires claude CLI
    import shutil
    claude_bin = shutil.which("claude") or os.path.expanduser("~/.local/bin/claude")
    vault_pipeline_available = os.path.isfile(claude_bin)

    return jsonify({
        "youtube": {"available": yt_available},
        "reddit": {
            "available": praw_installed,
            "configured": reddit_configured,
        },
        "web": {
            "available": firecrawl_installed,
            "configured": firecrawl_configured,
        },
        "vault_pipeline": {
            "available": vault_pipeline_available,
            "configured": vault_pipeline_available,
        },
    })
