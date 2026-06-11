from __future__ import annotations

"""Git worktree management and commit graph with agent attribution."""

import subprocess
from datetime import datetime, timedelta
from pathlib import Path

from app.services.git_local_service import _run


# ---------------------------------------------------------------------------
# Attribution constants
# ---------------------------------------------------------------------------

_CLAUDE_CO_PATTERNS = [
    "noreply@anthropic.com",
    "claude sonnet",
    "claude opus",
    "claude haiku",
    "claude code",
    "claude 4",
    "claude 3",
]
_CODEX_CO_PATTERNS = [
    "codex@openai.com",
    "openai codex",
    "codex cli",
]
_CLAUDE_EMAILS = {"noreply@anthropic.com"}
_CLAUDE_NAME_PATTERNS = ["claude sonnet", "claude opus", "claude haiku", "claude code"]
_CODEX_NAME_PATTERNS = ["codex", "openai/codex"]


# ---------------------------------------------------------------------------
# Worktree list
# ---------------------------------------------------------------------------

def list_worktrees(repo_path: Path) -> list[dict]:
    """Parse `git worktree list --porcelain` into structured records."""
    result = _run(repo_path, ["worktree", "list", "--porcelain"])
    if result.returncode != 0:
        return []

    worktrees: list[dict] = []
    current: dict | None = None

    for line in (result.stdout + "\n").splitlines():
        stripped = line.strip()
        if not stripped:
            if current:
                worktrees.append(current)
                current = None
            continue

        if stripped.startswith("worktree "):
            current = {
                "path": stripped[len("worktree "):],
                "head_hash": "",
                "branch": None,
                "is_main": False,
                "is_detached": False,
                "is_locked": False,
                "lock_reason": None,
                "prunable": False,
                "is_bare": False,
            }
        elif current is None:
            continue
        elif stripped.startswith("HEAD "):
            current["head_hash"] = stripped[5:]
        elif stripped.startswith("branch "):
            ref = stripped[7:]
            current["branch"] = (
                ref[len("refs/heads/"):] if ref.startswith("refs/heads/") else ref
            )
        elif stripped == "detached":
            current["is_detached"] = True
        elif stripped == "bare":
            current["is_bare"] = True
        elif stripped.startswith("locked"):
            current["is_locked"] = True
            rest = stripped[6:].strip()
            if rest:
                current["lock_reason"] = rest
        elif stripped.startswith("prunable"):
            current["prunable"] = True

    if current:
        worktrees.append(current)

    if worktrees:
        worktrees[0]["is_main"] = True

    return worktrees


# ---------------------------------------------------------------------------
# Worktree CRUD
# ---------------------------------------------------------------------------

def add_worktree(
    repo_path: Path,
    dest: str,
    branch: str,
    new_branch: bool = False,
) -> dict:
    """Create a new linked worktree. Raises RuntimeError on failure."""
    if new_branch:
        args = ["worktree", "add", "-b", branch, dest]
    else:
        args = ["worktree", "add", dest, branch]
    result = _run(repo_path, args, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip() or f"git worktree add failed (exit {result.returncode})"
        )
    return {"path": dest, "branch": branch, "new_branch": new_branch}


def remove_worktree(
    repo_path: Path,
    worktree_path: str,
    force: bool = False,
) -> None:
    """Remove a linked worktree. Raises RuntimeError on failure."""
    args = ["worktree", "remove"]
    if force:
        args.append("--force")
    args.append(worktree_path)
    result = _run(repo_path, args, timeout=15)
    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip() or "git worktree remove failed"
        )


def lock_worktree(
    repo_path: Path,
    worktree_path: str,
    reason: str = "",
) -> None:
    """Lock a worktree to prevent automatic pruning."""
    args = ["worktree", "lock"]
    if reason:
        args.extend(["--reason", reason])
    args.append(worktree_path)
    result = _run(repo_path, args)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git worktree lock failed")


def unlock_worktree(repo_path: Path, worktree_path: str) -> None:
    """Unlock a worktree."""
    result = _run(repo_path, ["worktree", "unlock", worktree_path])
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git worktree unlock failed")


# ---------------------------------------------------------------------------
# Attribution helpers
# ---------------------------------------------------------------------------

def _parse_co_authors(body: str) -> tuple[str | None, list[str]]:
    """Return (attribution, co_author_strings) from commit body trailers."""
    co_authors: list[str] = []
    attribution: str | None = None
    for line in body.splitlines():
        line = line.strip()
        if not line.lower().startswith("co-authored-by:"):
            continue
        co_author = line[len("co-authored-by:"):].strip()
        co_authors.append(co_author)
        if attribution is None:
            lower = co_author.lower()
            if any(p in lower for p in _CLAUDE_CO_PATTERNS):
                attribution = "claude"
            elif any(p in lower for p in _CODEX_CO_PATTERNS):
                attribution = "codex"
    return attribution, co_authors


def _attribution_from_author(author_name: str, author_email: str) -> str | None:
    email = author_email.strip().lower()
    name = author_name.strip().lower()
    if email in _CLAUDE_EMAILS or any(p in name for p in _CLAUDE_NAME_PATTERNS):
        return "claude"
    if any(p in name for p in _CODEX_NAME_PATTERNS):
        return "codex"
    return None


def _attribution_from_sessions(committed_at: str, branch: str | None) -> str | None:
    """Cross-reference commit timestamp + branch against recorded Codex sessions."""
    if not branch:
        return None
    try:
        commit_dt = datetime.fromisoformat(committed_at)
    except ValueError:
        return None
    try:
        from app.services import codex_tracker  # avoid circular at module load

        for usage in codex_tracker.load():
            if usage.get("git_branch") != branch:
                continue
            started = usage.get("started_at", "")
            ended = usage.get("ended_at", "")
            if not started or not ended:
                continue
            try:
                start_dt = datetime.fromisoformat(started)
                end_dt = datetime.fromisoformat(ended) + timedelta(minutes=5)
                if start_dt <= commit_dt <= end_dt:
                    return "codex"
            except ValueError:
                continue
    except Exception:
        pass
    return None


def _attribute_commit(
    body: str,
    author_name: str,
    author_email: str,
    committed_at: str,
    branch: str | None,
) -> dict:
    sources: list[str] = []
    attribution: str | None = None

    # Method 1: Co-Authored-By trailer
    co_attr, co_authors = _parse_co_authors(body)
    if co_attr:
        attribution = co_attr
        sources.append("co_authored_by")

    # Method 2: Author email / name pattern
    if attribution is None:
        name_attr = _attribution_from_author(author_name, author_email)
        if name_attr:
            attribution = name_attr
            sources.append("author_identity")

    # Method 3: Session cross-reference (Codex only)
    if attribution is None:
        sess_attr = _attribution_from_sessions(committed_at, branch)
        if sess_attr:
            attribution = sess_attr
            sources.append("session_crossref")

    return {
        "attribution": attribution or "user",
        "attribution_sources": sources,
        "co_authors": co_authors,
    }


# ---------------------------------------------------------------------------
# Commit graph
# ---------------------------------------------------------------------------

def get_commit_graph(repo_path: Path, limit: int = 200) -> list[dict]:
    """Return a list of commits in topo order with attribution metadata.

    Uses two git-log passes: one for structured metadata, one for commit bodies
    (needed for co-authored-by trailer parsing).
    """
    limit = max(1, min(limit, 1000))

    # Pass 1: metadata (fields separated by \x1f, records by \x1e)
    meta_fmt = "%H\x1f%P\x1f%s\x1f%an\x1f%ae\x1f%aI\x1f%D\x1e"
    meta_result = _run(
        repo_path,
        ["log", "--all", "--topo-order", f"-n{limit}", f"--format={meta_fmt}"],
        timeout=30,
    )
    if meta_result.returncode != 0:
        return []

    # Pass 2: hash + body (for trailer parsing)
    body_fmt = "%H\x1f%b\x1e"
    body_result = _run(
        repo_path,
        ["log", "--all", "--topo-order", f"-n{limit}", f"--format={body_fmt}"],
        timeout=30,
    )
    body_map: dict[str, str] = {}
    if body_result.returncode == 0:
        for record in body_result.stdout.split("\x1e"):
            record = record.strip()
            if not record:
                continue
            parts = record.split("\x1f", 1)
            if len(parts) == 2:
                body_map[parts[0].strip()] = parts[1].strip()

    commits: list[dict] = []
    for record in meta_result.stdout.split("\x1e"):
        record = record.strip()
        if not record:
            continue
        parts = record.split("\x1f")
        if len(parts) < 6:
            continue
        full_hash = parts[0]
        parents_str = parts[1]
        subject = parts[2]
        author_name = parts[3]
        author_email = parts[4]
        committed_at = parts[5]
        # %D (refs) is omitted by git when empty — default to empty string
        refs_str = parts[6] if len(parts) > 6 else ""
        parents = [p for p in parents_str.split() if p]
        refs = [r.strip() for r in refs_str.split(",") if r.strip()]
        body = body_map.get(full_hash, "")

        # Determine branch hint from refs (first local branch found)
        branch_hint: str | None = None
        for ref in refs:
            ref_lower = ref.lower()
            if ref_lower.startswith("head ->"):
                branch_hint = ref.split("->", 1)[1].strip()
                break
        if branch_hint is None:
            for ref in refs:
                if not ref.startswith("origin/") and not ref.startswith("tag:"):
                    branch_hint = ref
                    break

        attr = _attribute_commit(body, author_name, author_email, committed_at, branch_hint)

        commits.append({
            "hash": full_hash,
            "short_hash": full_hash[:7],
            "parents": parents,
            "subject": subject,
            "author_name": author_name,
            "author_email": author_email,
            "committed_at": committed_at,
            "refs": refs,
            "body": body,
            **attr,
        })

    return commits
