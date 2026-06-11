from __future__ import annotations

"""Subprocess-based git operations. All paths validated against configured roots."""

import subprocess
from datetime import datetime, timezone
from pathlib import Path


def validate_repo_path(repo_path: str, roots: list[dict]) -> Path:
    """Raise ValueError if repo_path is not under any configured root."""
    p = Path(repo_path).resolve()
    for root in roots:
        root_p = Path(root["path"]).resolve()
        try:
            p.relative_to(root_p)
            return p
        except ValueError:
            continue
    raise ValueError(f"Path is not under any configured root: {repo_path}")


def _run(repo_path: Path, args: list[str], timeout: int = 15) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git"] + args,
        cwd=repo_path,
        capture_output=True,
        text=True,
        timeout=timeout,
        shell=False,
    )


def get_remote_url(repo_path: Path) -> str | None:
    result = _run(repo_path, ["config", "--get", "remote.origin.url"])
    if result.returncode == 0:
        return result.stdout.strip() or None
    return None


def _parse_remote_owner_repo(remote_url: str | None) -> tuple[str | None, str | None]:
    if not remote_url:
        return None, None
    # Handle SSH: git@github.com:owner/repo.git
    # Handle HTTPS: https://github.com/owner/repo.git
    url = remote_url.strip()
    if "github.com" not in url:
        return None, None
    if url.startswith("git@"):
        parts = url.split(":")
        if len(parts) == 2:
            path = parts[1].removesuffix(".git")
            segments = path.split("/")
            if len(segments) == 2:
                return segments[0], segments[1]
    else:
        # https URL
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path.removesuffix(".git").strip("/")
            segments = path.split("/")
            if len(segments) == 2:
                return segments[0], segments[1]
        except Exception:
            pass
    return None, None


def get_status(repo_path: Path) -> dict:
    branch_result = _run(repo_path, ["rev-parse", "--abbrev-ref", "HEAD"])
    current_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else None

    status_result = _run(repo_path, ["status", "--porcelain=v1"])
    dirty = bool(status_result.stdout.strip()) if status_result.returncode == 0 else False

    ahead = behind = 0
    if current_branch:
        ab_result = _run(repo_path, ["rev-list", "--count", "--left-right", "@{upstream}...HEAD"])
        if ab_result.returncode == 0:
            parts = ab_result.stdout.strip().split()
            if len(parts) == 2:
                try:
                    behind, ahead = int(parts[0]), int(parts[1])
                except ValueError:
                    pass

    last_commit_at = None
    log_result = _run(repo_path, ["log", "-1", "--format=%aI"])
    if log_result.returncode == 0 and log_result.stdout.strip():
        last_commit_at = log_result.stdout.strip()

    remote_url = get_remote_url(repo_path)
    owner, repo = _parse_remote_owner_repo(remote_url)

    return {
        "current_branch": current_branch,
        "dirty": dirty,
        "ahead": ahead,
        "behind": behind,
        "last_commit_at": last_commit_at,
        "remote_url": remote_url,
        "remote_owner": owner,
        "remote_repo": repo,
    }


def list_branches(repo_path: Path) -> list[dict]:
    result = _run(repo_path, [
        "branch", "-a",
        "--format=%(refname:short)|%(upstream:short)|%(HEAD)|%(objectname:short)",
    ])
    if result.returncode != 0:
        return []
    branches: list[dict] = []
    for line in result.stdout.splitlines():
        parts = line.split("|")
        if len(parts) < 4:
            continue
        name, upstream, head_marker, short_hash = parts[0], parts[1], parts[2], parts[3]
        if not name:
            continue
        branches.append({
            "name": name,
            "upstream": upstream or None,
            "is_current": head_marker == "*",
            "short_hash": short_hash,
            "is_remote": name.startswith("remotes/"),
        })
    return branches


def recent_commits(repo_path: Path, since_days: int = 14) -> list[dict]:
    result = _run(repo_path, [
        "log",
        f"--since={since_days}.days.ago",
        "--no-merges",
        "--pretty=format:%H|%aI|%an|%ae|%s",
    ])
    if result.returncode != 0:
        return []
    commits: list[dict] = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("|", 4)
        if len(parts) < 5:
            continue
        commits.append({
            "hash": parts[0],
            "timestamp": parts[1],
            "author_name": parts[2],
            "author_email": parts[3],
            "subject": parts[4],
        })
    return commits
