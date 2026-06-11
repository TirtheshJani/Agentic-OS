from __future__ import annotations

"""Manage configured root paths and discover git repos under them."""

import hashlib
import os
import threading
import uuid
from pathlib import Path

import orjson

from app.config import GITHUB_REPOS_CONFIG

_DATA_FILE = Path(GITHUB_REPOS_CONFIG)
_lock = threading.Lock()

_SKIP_DIRS = {"node_modules", ".venv", "venv", "vendor", "__pycache__", ".git", "dist", "build"}
_MAX_DEPTH = 4


def _load() -> dict:
    if not _DATA_FILE.exists():
        return {"roots": []}
    try:
        with _lock:
            return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return {"roots": []}


def _save(data: dict) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _DATA_FILE.with_suffix(".tmp")
    with _lock:
        tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
        os.replace(tmp, _DATA_FILE)


def list_roots() -> list[dict]:
    return _load().get("roots", [])


def add_root(name: str, path: str) -> dict:
    # Normalise: add leading slash if user typed a bare path like "home/user/..."
    if path and not path.startswith("/") and not path.startswith("~"):
        path = "/" + path
    root_path = Path(path).expanduser().resolve()
    if not root_path.exists():
        raise ValueError(
            f"Path not found: {root_path}. "
            "If running via Docker, make sure the directory is mounted in docker-compose.yml. "
            "Only paths inside ~/Documents (and its subdirectories) are accessible by default."
        )
    if not root_path.is_dir():
        raise ValueError(f"Path is not a directory: {path}")
    root = {
        "id": str(uuid.uuid4()),
        "name": name,
        "path": str(root_path),
        "enabled": True,
    }
    data = _load()
    data.setdefault("roots", []).append(root)
    _save(data)
    return root


def remove_root(root_id: str) -> bool:
    data = _load()
    roots = data.get("roots", [])
    new_roots = [r for r in roots if r.get("id") != root_id]
    if len(new_roots) == len(roots):
        return False
    data["roots"] = new_roots
    _save(data)
    return True


def update_root(root_id: str, **kwargs) -> dict:
    data = _load()
    roots = data.get("roots", [])
    root = next((r for r in roots if r.get("id") == root_id), None)
    if root is None:
        raise ValueError(f"Root not found: {root_id}")
    allowed = {"name", "enabled", "path"}
    for k, v in kwargs.items():
        if k in allowed:
            root[k] = v
    _save(data)
    return root


def _repo_id(path: str) -> str:
    return hashlib.sha256(path.encode()).hexdigest()[:16]


def _walk_for_repos(base: Path, root_id: str, depth: int = 0) -> list[dict]:
    if depth > _MAX_DEPTH:
        return []
    results: list[dict] = []
    try:
        entries = list(base.iterdir())
    except PermissionError:
        return []
    git_dir = base / ".git"
    if git_dir.exists():
        results.append({
            "id": _repo_id(str(base)),
            "root_id": root_id,
            "name": base.name,
            "path": str(base),
        })
        return results
    for entry in entries:
        if not entry.is_dir() or entry.name in _SKIP_DIRS or entry.name.startswith("."):
            continue
        results.extend(_walk_for_repos(entry, root_id, depth + 1))
    return results


def discover_repos(root_id: str | None = None) -> list[dict]:
    roots = list_roots()
    if root_id is not None:
        roots = [r for r in roots if r.get("id") == root_id]
    repos: list[dict] = []
    for root in roots:
        if not root.get("enabled", True):
            continue
        base = Path(root["path"])
        if not base.exists():
            continue
        repos.extend(_walk_for_repos(base, root["id"]))
    return repos
