from __future__ import annotations

"""GitHub REST API client with ETag caching. Returns sentinel on auth failure."""

import threading
from typing import Any

import httpx

from app.config import GITHUB_TOKEN, GITHUB_API_BASE

_etag_cache: dict[str, tuple[str, Any]] = {}
_cache_lock = threading.Lock()

_HEADERS_BASE = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

_NO_AUTH = {"github_auth": False}


def _is_configured() -> bool:
    return bool(GITHUB_TOKEN)


def _headers() -> dict:
    h = dict(_HEADERS_BASE)
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


def _get(path: str, params: dict | None = None) -> Any:
    if not _is_configured():
        return _NO_AUTH
    url = f"{GITHUB_API_BASE}{path}"
    req_headers = _headers()
    with _cache_lock:
        cached = _etag_cache.get(url)
    if cached:
        req_headers["If-None-Match"] = cached[0]
    try:
        resp = httpx.get(url, headers=req_headers, params=params, timeout=15)
    except Exception:
        return _NO_AUTH
    if resp.status_code == 304 and cached:
        return cached[1]
    if resp.status_code in (401, 403):
        return _NO_AUTH
    if resp.status_code == 429:
        return _NO_AUTH
    if not resp.is_success:
        return {}
    data = resp.json()
    etag = resp.headers.get("ETag")
    if etag:
        with _cache_lock:
            _etag_cache[url] = (etag, data)
    return data


def get_authenticated_user() -> dict:
    result = _get("/user")
    if isinstance(result, dict) and result.get("github_auth") is False:
        return result
    return result if isinstance(result, dict) else _NO_AUTH


def get_open_prs(login: str) -> dict:
    result = _get("/search/issues", params={
        "q": f"is:open is:pr author:{login}",
        "per_page": 50,
        "sort": "updated",
    })
    if isinstance(result, dict) and result.get("github_auth") is False:
        return {"github_auth": False, "items": [], "total_count": 0}
    if not isinstance(result, dict):
        return {"github_auth": True, "items": [], "total_count": 0}
    items = []
    for item in result.get("items", []):
        repo_full = item.get("repository_url", "").replace("https://api.github.com/repos/", "")
        items.append({
            "id": item.get("id"),
            "number": item.get("number"),
            "title": item.get("title"),
            "html_url": item.get("html_url"),
            "repo_full_name": repo_full,
            "state": item.get("state"),
            "draft": item.get("draft", False),
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at"),
            "labels": [lb.get("name") for lb in item.get("labels", [])],
        })
    return {"github_auth": True, "items": items, "total_count": result.get("total_count", len(items))}


def get_assigned_issues(login: str) -> dict:
    result = _get("/search/issues", params={
        "q": f"is:open is:issue assignee:{login}",
        "per_page": 50,
        "sort": "updated",
    })
    if isinstance(result, dict) and result.get("github_auth") is False:
        return {"github_auth": False, "items": [], "total_count": 0}
    if not isinstance(result, dict):
        return {"github_auth": True, "items": [], "total_count": 0}
    items = []
    for item in result.get("items", []):
        repo_full = item.get("repository_url", "").replace("https://api.github.com/repos/", "")
        milestone = item.get("milestone")
        items.append({
            "id": item.get("id"),
            "number": item.get("number"),
            "title": item.get("title"),
            "html_url": item.get("html_url"),
            "repo_full_name": repo_full,
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at"),
            "labels": [lb.get("name") for lb in item.get("labels", [])],
            "milestone": milestone.get("title") if milestone else None,
        })
    return {"github_auth": True, "items": items, "total_count": result.get("total_count", len(items))}


def get_open_milestones(repos: list[str]) -> dict:
    if not _is_configured():
        return {"github_auth": False, "items": []}
    from concurrent.futures import ThreadPoolExecutor

    def _fetch_repo_milestones(full_name: str) -> list[dict]:
        result = _get(f"/repos/{full_name}/milestones", params={"state": "open"})
        if not isinstance(result, list):
            return []
        return [
            {
                "id": m.get("id"),
                "number": m.get("number"),
                "title": m.get("title"),
                "html_url": m.get("html_url"),
                "repo_full_name": full_name,
                "due_on": m.get("due_on"),
                "open_issues": m.get("open_issues", 0),
                "description": m.get("description", ""),
            }
            for m in result
        ]

    items: list[dict] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for milestones in pool.map(_fetch_repo_milestones, repos[:20]):
            items.extend(milestones)
    return {"github_auth": True, "items": items}


def get_rate_limit() -> dict:
    result = _get("/rate_limit")
    if isinstance(result, dict) and result.get("github_auth") is False:
        return result
    if isinstance(result, dict):
        core = result.get("resources", {}).get("core", {})
        return {
            "github_auth": True,
            "remaining": core.get("remaining"),
            "limit": core.get("limit"),
            "reset": core.get("reset"),
        }
    return {"github_auth": False}
