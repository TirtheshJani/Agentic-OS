from __future__ import annotations

"""Background refresh that builds github_snapshot.json every N seconds."""

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.config import GITHUB_SNAPSHOT_INTERVAL
from app.services import github_repos_service, git_local_service, github_api_service

_SNAPSHOT_FILE = Path(__file__).parent.parent.parent / "data" / "github_snapshot.json"
_lock = threading.Lock()


def _enrich_repo(repo: dict, roots: list[dict]) -> dict:
    try:
        path = git_local_service.validate_repo_path(repo["path"], roots)
        status = git_local_service.get_status(path)
        commits = git_local_service.recent_commits(path, since_days=14)
        return {**repo, **status, "recent_commits": commits}
    except Exception:
        return {**repo, "recent_commits": []}


def _build_snapshot() -> dict:
    roots = github_repos_service.list_roots()
    repos = github_repos_service.discover_repos()

    enriched_repos: list[dict] = []
    if repos:
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(_enrich_repo, r, roots): r for r in repos}
            for future in as_completed(futures):
                try:
                    enriched_repos.append(future.result())
                except Exception:
                    enriched_repos.append(futures[future])

    user = github_api_service.get_authenticated_user()
    github_auth = not (isinstance(user, dict) and user.get("github_auth") is False)
    login = user.get("login") if github_auth and isinstance(user, dict) else None

    prs: dict = {"github_auth": github_auth, "items": [], "total_count": 0}
    issues: dict = {"github_auth": github_auth, "items": [], "total_count": 0}
    milestones: dict = {"github_auth": github_auth, "items": []}
    rate_limit: dict | None = None

    if github_auth and login:
        prs = github_api_service.get_open_prs(login)
        issues = github_api_service.get_assigned_issues(login)
        github_repos = list({
            r.get("remote_owner") + "/" + r.get("remote_repo")
            for r in enriched_repos
            if r.get("remote_owner") and r.get("remote_repo")
        })
        issue_repos = list({i.get("repo_full_name") for i in issues.get("items", []) if i.get("repo_full_name")})
        all_repos = list(set(github_repos + issue_repos))
        if all_repos:
            milestones = github_api_service.get_open_milestones(all_repos)
        rate_limit = github_api_service.get_rate_limit()

    activity: list[dict] = []
    for repo in enriched_repos:
        for commit in repo.get("recent_commits", []):
            activity.append({**commit, "repo": repo["name"], "repo_path": repo["path"]})
    activity.sort(key=lambda c: c.get("timestamp", ""), reverse=True)

    snapshot = {
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
        "github_auth": github_auth,
        "github_login": login,
        "rate_limit": rate_limit,
        "repos": [{k: v for k, v in r.items() if k != "recent_commits"} for r in enriched_repos],
        "prs": prs,
        "issues": issues,
        "milestones": milestones,
        "activity": activity[:500],
    }

    _SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _SNAPSHOT_FILE.with_suffix(".tmp")
    with _lock:
        tmp.write_bytes(orjson.dumps(snapshot, option=orjson.OPT_INDENT_2))
        os.replace(tmp, _SNAPSHOT_FILE)

    return snapshot


def get_snapshot() -> dict:
    with _lock:
        if not _SNAPSHOT_FILE.exists():
            return {}
        try:
            return orjson.loads(_SNAPSHOT_FILE.read_bytes())
        except Exception:
            return {}


def refresh_snapshot() -> dict:
    return _build_snapshot()


def start_background_refresh() -> None:
    def _worker():
        time.sleep(8)
        while True:
            try:
                _build_snapshot()
            except Exception:
                pass
            time.sleep(GITHUB_SNAPSHOT_INTERVAL)

    t = threading.Thread(target=_worker, daemon=True, name="github-snapshot")
    t.start()
