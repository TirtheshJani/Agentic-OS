"""
Static code-quality helpers for the eval system.

Provides:
  - detect_repo(cwd)         → git root path or None
  - get_session_commits(...) → list of commit dicts in a time window
  - get_diff_stats(...)      → insertions/deletions/files_changed for a session
  - run_static_analysis(...) → post-session error counts (tsc / pylint)
"""
from __future__ import annotations

import subprocess
from pathlib import Path


def _run(cmd: list[str], cwd: str | None = None, timeout: int = 30) -> tuple[int, str, str]:
    """Run a subprocess and return (returncode, stdout, stderr)."""
    try:
        r = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return r.returncode, r.stdout, r.stderr
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return -1, "", ""


def detect_repo(cwd: str) -> str | None:
    """Return the git root for *cwd*, or None if it is not inside a git repo."""
    if not cwd or not Path(cwd).exists():
        return None
    code, out, _ = _run(["git", "rev-parse", "--show-toplevel"], cwd=cwd)
    root = out.strip()
    return root if code == 0 and root else None


def get_session_commits(repo: str, since: str, until: str) -> list[dict]:
    """
    Return commits made in *repo* between *since* and *until* (ISO-8601 strings).

    Each item: {hash, author, date, subject}
    """
    fmt = "%H\x1f%an\x1f%aI\x1f%s"
    code, out, _ = _run(
        [
            "git", "log",
            f"--since={since}",
            f"--until={until}",
            f"--format={fmt}",
            "--no-merges",
        ],
        cwd=repo,
    )
    if code != 0 or not out.strip():
        return []

    commits = []
    for line in out.strip().splitlines():
        parts = line.split("\x1f", 3)
        if len(parts) == 4:
            commits.append({
                "hash": parts[0],
                "author": parts[1],
                "date": parts[2],
                "subject": parts[3],
            })
    return commits


def get_diff_stats(repo: str, commits: list[dict]) -> dict:
    """
    Return aggregate diff stats for a list of commits.

    Returns {files_changed, insertions, deletions, commit_count}.
    Uses `git diff --shortstat <first>^..<last>` when 2+ commits exist,
    otherwise `git show --shortstat <hash>` for a single commit.
    """
    empty = {"files_changed": 0, "insertions": 0, "deletions": 0, "commit_count": 0}
    if not commits:
        return empty

    count = len(commits)
    if count == 1:
        code, out, _ = _run(
            ["git", "show", "--stat", "--format=", commits[0]["hash"]],
            cwd=repo,
        )
    else:
        first = commits[-1]["hash"]  # oldest first in git log output
        last = commits[0]["hash"]    # newest
        code, out, _ = _run(
            ["git", "diff", "--shortstat", f"{first}^", last],
            cwd=repo,
        )

    if code != 0 or not out.strip():
        return {**empty, "commit_count": count}

    return {**_parse_shortstat(out), "commit_count": count}


def _parse_shortstat(text: str) -> dict:
    """Parse `git diff --shortstat` output into {files_changed, insertions, deletions}."""
    import re
    files = insertions = deletions = 0
    m = re.search(r"(\d+) file", text)
    if m:
        files = int(m.group(1))
    m = re.search(r"(\d+) insertion", text)
    if m:
        insertions = int(m.group(1))
    m = re.search(r"(\d+) deletion", text)
    if m:
        deletions = int(m.group(1))
    return {"files_changed": files, "insertions": insertions, "deletions": deletions}


def run_static_analysis(cwd: str) -> dict:
    """
    Run available static analysis tools in *cwd* and return error counts.

    Only performs a *post-session* snapshot (no git stash trick).
    Returns {ts_errors, pylint_errors, available_tools}.
    """
    result: dict = {"ts_errors": None, "pylint_errors": None, "available_tools": []}
    if not cwd or not Path(cwd).exists():
        return result

    # TypeScript: check for tsconfig.json
    if Path(cwd, "tsconfig.json").exists():
        code, out, err = _run(["npx", "--yes", "tsc", "--noEmit", "--pretty", "false"], cwd=cwd, timeout=60)
        combined = out + err
        # Count "error TS" occurrences
        ts_errors = combined.count("error TS")
        result["ts_errors"] = ts_errors
        result["available_tools"].append("tsc")

    # Python: check for py files and pylint availability
    py_files = list(Path(cwd).glob("*.py"))
    if not py_files:
        py_files = list(Path(cwd).glob("**/*.py"))
    if py_files:
        code, out, _ = _run(["python", "-m", "pylint", "--output-format=text", str(cwd)], cwd=cwd, timeout=60)
        if code != -1:  # -1 means pylint not found
            # pylint exit codes: 0=ok, 1-32=errors (bitmask). Count "E" errors from output.
            import re
            errors = len(re.findall(r"^.+: E\d{4}", out, re.MULTILINE))
            result["pylint_errors"] = errors
            result["available_tools"].append("pylint")

    return result
