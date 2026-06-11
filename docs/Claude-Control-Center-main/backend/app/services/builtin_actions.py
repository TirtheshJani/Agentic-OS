"""
Built-in maintenance actions for the in-app scheduler (issue #24).

Each action is a plain function ``(params: dict) -> dict`` returning a small
JSON-safe result summary that lands in the scheduler run record. All actions
are deliberately conservative: they report and aggregate, but never delete or
rewrite user data. ``REGISTRY`` is the single source of truth the API exposes
to the frontend (id, name, description, param descriptions).
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import CLAUDE_DIR

logger = logging.getLogger(__name__)

_MAX_SCAN_FILES = 20_000  # hard cap so a runaway projects dir can't stall a run


def _projects_dir() -> Path:
    return Path(CLAUDE_DIR) / "projects"


# ---------------------------------------------------------------------------
# memory_consolidate — report duplicate memory entries + index drift
# ---------------------------------------------------------------------------

def memory_consolidate(params: dict) -> dict:
    """Scan every project memory dir for duplicate bodies and MEMORY.md drift.

    Non-destructive: reports duplicates (same content hash in one project),
    index entries pointing at missing files, and files absent from the index.
    """
    projects = _projects_dir()
    report: list[dict] = []
    scanned_files = 0
    if projects.is_dir():
        for memory_dir in sorted(projects.glob("*/memory")):
            files = [p for p in memory_dir.glob("*.md") if p.name != "MEMORY.md"]
            scanned_files += len(files)
            by_hash: dict[str, list[str]] = {}
            for f in files:
                try:
                    digest = hashlib.sha256(f.read_bytes()).hexdigest()
                except OSError:
                    continue
                by_hash.setdefault(digest, []).append(f.name)
            duplicates = [names for names in by_hash.values() if len(names) > 1]

            index_file = memory_dir / "MEMORY.md"
            indexed: set[str] = set()
            if index_file.exists():
                try:
                    for line in index_file.read_text(errors="replace").splitlines():
                        # Index lines look like: - [Title](file.md) — hook
                        if "](" in line:
                            indexed.add(line.split("](", 1)[1].split(")", 1)[0])
                except OSError:
                    pass
            file_names = {f.name for f in files}
            missing_from_disk = sorted(indexed - file_names)
            missing_from_index = sorted(file_names - indexed) if index_file.exists() else []

            if duplicates or missing_from_disk or missing_from_index:
                report.append({
                    "project": memory_dir.parent.name,
                    "duplicates": duplicates,
                    "index_entries_missing_file": missing_from_disk,
                    "files_missing_from_index": missing_from_index,
                })
    return {
        "scanned_files": scanned_files,
        "projects_with_findings": len(report),
        "findings": report[:50],
    }


# ---------------------------------------------------------------------------
# session_tidy — report (optionally archive) stale empty session files
# ---------------------------------------------------------------------------

def session_tidy(params: dict) -> dict:
    """Find stale, effectively-empty session JSONL files.

    Report-only by default. With ``{"archive": true}`` empty files older than
    ``days`` (default 30) move to ``<CLAUDE_DIR>/ccc-archive/sessions/`` —
    never deleted. ``max_bytes`` (default 0) sets the "empty" threshold.
    """
    days = int(params.get("days", 30))
    max_bytes = int(params.get("max_bytes", 0))
    archive = bool(params.get("archive", False))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    projects = _projects_dir()
    stale: list[dict] = []
    archived = 0
    scanned = 0
    if projects.is_dir():
        for jsonl in projects.glob("*/*.jsonl"):
            scanned += 1
            if scanned > _MAX_SCAN_FILES:
                break
            try:
                st = jsonl.stat()
            except OSError:
                continue
            mtime = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc)
            if st.st_size > max_bytes or mtime >= cutoff:
                continue
            entry = {
                "project": jsonl.parent.name,
                "file": jsonl.name,
                "size_bytes": st.st_size,
                "modified_at": mtime.isoformat(),
            }
            if archive:
                dest_dir = Path(CLAUDE_DIR) / "ccc-archive" / "sessions" / jsonl.parent.name
                try:
                    dest_dir.mkdir(parents=True, exist_ok=True)
                    jsonl.rename(dest_dir / jsonl.name)
                    entry["archived"] = True
                    archived += 1
                except OSError as exc:
                    entry["archived"] = False
                    entry["error"] = str(exc)
            stale.append(entry)
    return {
        "scanned_files": scanned,
        "stale_files": len(stale),
        "archived": archived,
        "mode": "archive" if archive else "report-only",
        "items": stale[:100],
    }


# ---------------------------------------------------------------------------
# client_digest — run a GWS digest workflow via the existing gws CLI bridge
# ---------------------------------------------------------------------------

def client_digest(params: dict) -> dict:
    """Run a GWS workflow recipe (default ``+weekly-digest``) via the gws CLI."""
    from app.services import gws_service

    workflow = str(params.get("workflow", "+weekly-digest"))
    if not workflow.startswith("+"):
        workflow = f"+{workflow}"
    args = ["workflow", workflow]
    gws_service.validate_args(args)
    if gws_service.resolve_binary() is None:
        raise RuntimeError("gws binary not found — client_digest needs the gws CLI")
    result = gws_service.run_command(args, timeout=120, source="scheduler")
    if result.get("returncode") != 0:
        raise RuntimeError(
            f"gws workflow {workflow} failed (rc={result.get('returncode')}): "
            f"{(result.get('stderr') or '')[:500]}"
        )
    return {
        "workflow": workflow,
        "returncode": result.get("returncode"),
        "duration_ms": result.get("duration_ms"),
        "stdout_tail": (result.get("stdout") or "")[-1000:],
    }


# ---------------------------------------------------------------------------
# eval_backfill — grade recent un-evaluated sessions via the eval service
# ---------------------------------------------------------------------------

def eval_backfill(params: dict) -> dict:
    """Run the eval judge over ungraded sessions (respects its daily budget)."""
    from app.services import eval_service

    limit = max(1, min(int(params.get("limit", 20)), 100))
    graded = eval_service.scan_ungraded(limit=limit)
    return {"limit": limit, "graded": graded}


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

REGISTRY: dict[str, dict] = {
    "memory_consolidate": {
        "name": "Memory consolidation",
        "description": "Report duplicate memory entries and MEMORY.md index drift across all projects. Non-destructive.",
        "params": {},
        "fn": memory_consolidate,
    },
    "session_tidy": {
        "name": "Session tidy",
        "description": "Report stale empty session JSONL files; optionally archive (never delete) with archive=true.",
        "params": {
            "days": "Minimum age in days (default 30)",
            "max_bytes": "Max size in bytes to count as empty (default 0)",
            "archive": "Move matches to ~/.claude/ccc-archive/sessions/ (default false)",
        },
        "fn": session_tidy,
    },
    "client_digest": {
        "name": "Client digest",
        "description": "Run a GWS digest workflow (default +weekly-digest) via the gws CLI bridge.",
        "params": {"workflow": "GWS workflow recipe id (default +weekly-digest)"},
        "fn": client_digest,
    },
    "eval_backfill": {
        "name": "Eval backfill",
        "description": "Grade recent un-evaluated sessions with the eval judge (daily budget applies).",
        "params": {"limit": "Max sessions to grade per run (default 20, cap 100)"},
        "fn": eval_backfill,
    },
}


def list_actions() -> list[dict]:
    return [
        {"id": action_id, "name": meta["name"], "description": meta["description"], "params": meta["params"]}
        for action_id, meta in REGISTRY.items()
    ]


def execute(action_id: str, params: dict) -> dict:
    meta = REGISTRY.get(action_id)
    if meta is None:
        raise ValueError(f"unknown action: {action_id!r}")
    return meta["fn"](params or {})
