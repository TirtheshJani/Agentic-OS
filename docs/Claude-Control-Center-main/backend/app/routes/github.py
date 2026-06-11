from __future__ import annotations

import threading
from datetime import datetime, timezone

import orjson
from flask import Blueprint, Response, jsonify, request

from app.config import GITHUB_TOKEN
from app.services import (
    github_repos_service,
    git_local_service,
    github_snapshot_service,
)

bp = Blueprint("github", __name__, url_prefix="/api/github")


def _orjson_response(data, status: int = 200) -> Response:
    return Response(
        orjson.dumps(data),
        status=status,
        mimetype="application/json",
    )


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

@bp.get("/status")
def get_status():
    snapshot = github_snapshot_service.get_snapshot()
    refreshed_at = snapshot.get("refreshed_at")
    age = None
    if refreshed_at:
        try:
            ts = datetime.fromisoformat(refreshed_at)
            age = int((datetime.now(timezone.utc) - ts).total_seconds())
        except Exception:
            pass
    return _orjson_response({
        "token_configured": bool(GITHUB_TOKEN),
        "github_auth": snapshot.get("github_auth", False),
        "github_login": snapshot.get("github_login"),
        "rate_limit": snapshot.get("rate_limit"),
        "snapshot_age_seconds": age,
        "snapshot_refreshed_at": refreshed_at,
    })


# ---------------------------------------------------------------------------
# Root path management
# ---------------------------------------------------------------------------

@bp.get("/roots")
def list_roots():
    return _orjson_response(github_repos_service.list_roots())


@bp.post("/roots")
def add_root():
    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()
    path = body.get("path", "").strip()
    if not name or not path:
        return jsonify({"error": "name and path required"}), 400
    try:
        root = github_repos_service.add_root(name, path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    _queue_refresh()
    return _orjson_response(root, 201)


@bp.delete("/roots/<root_id>")
def remove_root(root_id: str):
    removed = github_repos_service.remove_root(root_id)
    if not removed:
        return jsonify({"error": "Root not found"}), 404
    _queue_refresh()
    return _orjson_response({"removed": True})


@bp.put("/roots/<root_id>")
def update_root(root_id: str):
    body = request.get_json(silent=True) or {}
    try:
        root = github_repos_service.update_root(root_id, **body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    _queue_refresh()
    return _orjson_response(root)


# ---------------------------------------------------------------------------
# Repos & branches
# ---------------------------------------------------------------------------

@bp.get("/repos")
def list_repos():
    snapshot = github_snapshot_service.get_snapshot()
    repos = snapshot.get("repos")
    if repos is None:
        repos = github_repos_service.discover_repos()
    return _orjson_response(repos)


@bp.get("/branches")
def list_branches():
    repo_path = request.args.get("repo", "").strip()
    if not repo_path:
        return jsonify({"error": "repo parameter required"}), 400
    roots = github_repos_service.list_roots()
    try:
        validated = git_local_service.validate_repo_path(repo_path, roots)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    branches = git_local_service.list_branches(validated)
    return _orjson_response(branches)


# ---------------------------------------------------------------------------
# Activity (commit timeline)
# ---------------------------------------------------------------------------

@bp.get("/activity")
def get_activity():
    try:
        days = int(request.args.get("days", 14))
        days = max(1, min(days, 90))
    except ValueError:
        days = 14

    snapshot = github_snapshot_service.get_snapshot()
    activity = snapshot.get("activity")
    if activity is None:
        # Build live if no snapshot
        roots = github_repos_service.list_roots()
        repos = github_repos_service.discover_repos()
        activity = []
        for repo in repos:
            try:
                path = git_local_service.validate_repo_path(repo["path"], roots)
                commits = git_local_service.recent_commits(path, since_days=days)
                for c in commits:
                    activity.append({**c, "repo": repo["name"], "repo_path": repo["path"]})
            except Exception:
                continue
        activity.sort(key=lambda c: c.get("timestamp", ""), reverse=True)

    return _orjson_response(activity)


# ---------------------------------------------------------------------------
# GitHub API (PAT-gated)
# ---------------------------------------------------------------------------

@bp.get("/prs")
def get_prs():
    snapshot = github_snapshot_service.get_snapshot()
    prs = snapshot.get("prs")
    if prs is None:
        if not GITHUB_TOKEN:
            return _orjson_response({"github_auth": False, "items": [], "total_count": 0})
        from app.services import github_api_service
        user = github_api_service.get_authenticated_user()
        login = user.get("login") if isinstance(user, dict) and user.get("github_auth") is not False else None
        if not login:
            return _orjson_response({"github_auth": False, "items": [], "total_count": 0})
        prs = github_api_service.get_open_prs(login)
    return _orjson_response(prs)


@bp.get("/issues")
def get_issues():
    snapshot = github_snapshot_service.get_snapshot()
    issues = snapshot.get("issues")
    if issues is None:
        if not GITHUB_TOKEN:
            return _orjson_response({"github_auth": False, "items": [], "total_count": 0})
        from app.services import github_api_service
        user = github_api_service.get_authenticated_user()
        login = user.get("login") if isinstance(user, dict) and user.get("github_auth") is not False else None
        if not login:
            return _orjson_response({"github_auth": False, "items": [], "total_count": 0})
        issues = github_api_service.get_assigned_issues(login)
    return _orjson_response(issues)


@bp.get("/milestones")
def get_milestones():
    snapshot = github_snapshot_service.get_snapshot()
    milestones = snapshot.get("milestones")
    if milestones is None:
        if not GITHUB_TOKEN:
            return _orjson_response({"github_auth": False, "items": []})
        milestones = {"github_auth": True, "items": []}
    return _orjson_response(milestones)


# ---------------------------------------------------------------------------
# Manual refresh
# ---------------------------------------------------------------------------

@bp.post("/refresh")
def trigger_refresh():
    _queue_refresh()
    return _orjson_response({"queued": True})


def _queue_refresh() -> None:
    def _do():
        try:
            github_snapshot_service.refresh_snapshot()
        except Exception:
            pass

    threading.Thread(target=_do, daemon=True, name="github-refresh-manual").start()
