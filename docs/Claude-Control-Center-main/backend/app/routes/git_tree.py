from __future__ import annotations

"""Git Tree API — worktree management and commit graph with attribution."""

from flask import Blueprint, Response, abort, jsonify, request

import orjson

from app.services import github_repos_service, git_local_service, git_worktree_service

bp = Blueprint("git_tree", __name__, url_prefix="/api/git-tree")


def _orjson_response(data, status: int = 200) -> Response:
    return Response(
        orjson.dumps(data),
        status=status,
        mimetype="application/json",
    )


def _get_repo(repo_id: str):
    """Return (repo_dict, validated_path) or abort 404."""
    repos = github_repos_service.discover_repos()
    repo = next((r for r in repos if r.get("id") == repo_id), None)
    if repo is None:
        abort(404, description="Repo not found")
    roots = github_repos_service.list_roots()
    try:
        path = git_local_service.validate_repo_path(repo["path"], roots)
    except ValueError as exc:
        abort(400, description=str(exc))
    return repo, path


# ---------------------------------------------------------------------------
# Repo list (reuses github roots discovery)
# ---------------------------------------------------------------------------

@bp.get("/repos")
def list_repos():
    repos = github_repos_service.discover_repos()
    return _orjson_response(repos)


# ---------------------------------------------------------------------------
# Worktree endpoints
# ---------------------------------------------------------------------------

@bp.get("/all-worktrees")
def all_worktrees():
    """Return worktrees for all enabled repos."""
    repos = github_repos_service.discover_repos()
    roots = github_repos_service.list_roots()
    result = []
    for repo in repos:
        try:
            path = git_local_service.validate_repo_path(repo["path"], roots)
            wts = git_worktree_service.list_worktrees(path)
            for wt in wts:
                result.append({**wt, "repo_id": repo["id"], "repo_name": repo["name"]})
        except Exception:
            continue
    return _orjson_response(result)


@bp.get("/repos/<repo_id>/worktrees")
def list_worktrees(repo_id: str):
    _, path = _get_repo(repo_id)
    return _orjson_response(git_worktree_service.list_worktrees(path))


@bp.post("/repos/<repo_id>/worktrees")
def create_worktree(repo_id: str):
    _, path = _get_repo(repo_id)
    body = request.get_json(silent=True) or {}
    dest = (body.get("dest") or "").strip()
    branch = (body.get("branch") or "").strip()
    new_branch = bool(body.get("new_branch", False))
    if not dest or not branch:
        return jsonify({"error": "dest and branch are required"}), 400
    try:
        result = git_worktree_service.add_worktree(path, dest, branch, new_branch)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 422
    return _orjson_response(result, 201)


@bp.delete("/repos/<repo_id>/worktrees")
def delete_worktree(repo_id: str):
    _, path = _get_repo(repo_id)
    body = request.get_json(silent=True) or {}
    wt_path = (body.get("path") or "").strip()
    force = bool(body.get("force", False))
    if not wt_path:
        return jsonify({"error": "path is required"}), 400
    try:
        git_worktree_service.remove_worktree(path, wt_path, force=force)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 422
    return _orjson_response({"removed": True})


@bp.post("/repos/<repo_id>/worktrees/lock")
def lock_worktree(repo_id: str):
    _, path = _get_repo(repo_id)
    body = request.get_json(silent=True) or {}
    wt_path = (body.get("path") or "").strip()
    reason = (body.get("reason") or "").strip()
    if not wt_path:
        return jsonify({"error": "path is required"}), 400
    try:
        git_worktree_service.lock_worktree(path, wt_path, reason)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 422
    return _orjson_response({"locked": True})


@bp.post("/repos/<repo_id>/worktrees/unlock")
def unlock_worktree(repo_id: str):
    _, path = _get_repo(repo_id)
    body = request.get_json(silent=True) or {}
    wt_path = (body.get("path") or "").strip()
    if not wt_path:
        return jsonify({"error": "path is required"}), 400
    try:
        git_worktree_service.unlock_worktree(path, wt_path)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 422
    return _orjson_response({"unlocked": True})


# ---------------------------------------------------------------------------
# Commit graph
# ---------------------------------------------------------------------------

@bp.get("/repos/<repo_id>/graph")
def commit_graph(repo_id: str):
    _, path = _get_repo(repo_id)
    try:
        limit = int(request.args.get("limit", 100))
        limit = max(1, min(limit, 500))
    except ValueError:
        limit = 100
    commits = git_worktree_service.get_commit_graph(path, limit=limit)
    return _orjson_response(commits)
