"""
Routines / Skills usage tracker.

Scans all session JSONL files under ~/.claude/projects/ for Skill tool_use
blocks (routine invocations via /skill-name slash commands). Pairs each
invocation with its subsequent tool_result to capture output and duration.

Records are stored in backend/data/routines_usages.json.
"""
from __future__ import annotations

import threading
from datetime import datetime
from pathlib import Path

import orjson

from app.config import CLAUDE_DIR
from app.services.project_decoder import decode_project_dir, display_name

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "routines_usages.json"
_MAX_OUTPUT_BYTES = 4096

_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _iter_raw(path: Path):
    with open(path, "rb") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                yield orjson.loads(raw)
            except Exception:
                continue


def _extract_text(content) -> str:
    """Pull plain text out of a tool_result content field."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif isinstance(block.get("content"), str):
                    parts.append(block["content"])
        return "\n".join(parts)
    return ""


def _scan_file(jsonl_path: Path, project_dirname: str) -> list[dict]:
    """Return Skill/routine invocation records from a single JSONL file."""
    records: list[dict] = []

    messages = list(_iter_raw(jsonl_path))

    # Index tool_result blocks by tool_use_id for fast result lookup
    result_map: dict[str, dict] = {}
    for msg in messages:
        if msg.get("type") != "user":
            continue
        content = msg.get("message", {}).get("content") or msg.get("content") or []
        if isinstance(content, str):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_result":
                tid = block.get("tool_use_id")
                if tid:
                    result_map[tid] = {
                        "timestamp": msg.get("timestamp"),
                        "content": block.get("content", ""),
                        "is_error": block.get("is_error", False),
                    }

    session_id = jsonl_path.stem
    cwd = None
    git_branch = None

    for msg in messages:
        if msg.get("type") != "assistant":
            continue

        if cwd is None:
            cwd = msg.get("cwd")
            git_branch = msg.get("gitBranch")

        content = msg.get("message", {}).get("content") or msg.get("content") or []
        if isinstance(content, str):
            continue

        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") != "tool_use":
                continue
            if block.get("name") != "Skill":
                continue

            inp = block.get("input") or {}
            skill_name = inp.get("skill", "")
            args = inp.get("args", "")
            caller_type = (block.get("caller") or {}).get("type", "unknown")

            tool_use_id = block.get("id", "")
            started_at = msg.get("timestamp")

            result = result_map.get(tool_use_id)
            ended_at = result["timestamp"] if result else None
            raw_output = _extract_text(result["content"]) if result else ""
            output = raw_output[:_MAX_OUTPUT_BYTES] if raw_output else ""
            is_error = result["is_error"] if result else False

            duration_seconds = None
            if started_at and ended_at:
                try:
                    t0 = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                    t1 = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
                    duration_seconds = round((t1 - t0).total_seconds(), 1)
                except Exception:
                    pass

            records.append({
                "session_id": session_id,
                "project_dir": project_dirname,
                "project": display_name(project_dirname),
                "project_path": decode_project_dir(project_dirname),
                "cwd": cwd,
                "git_branch": git_branch,
                "tool_use_id": tool_use_id,
                "skill": skill_name,
                "args": args,
                "caller_type": caller_type,
                "started_at": started_at,
                "ended_at": ended_at,
                "duration_seconds": duration_seconds,
                "output": output,
                "status": "error" if is_error else ("success" if result else "unknown"),
            })

    return records


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scan_all() -> list[dict]:
    """Scan every session JSONL in ~/.claude/projects/ and return all routine records."""
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.exists():
        return []

    all_records: list[dict] = []
    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        dirname = project_dir.name
        for jsonl_file in project_dir.glob("*.jsonl"):
            try:
                all_records.extend(_scan_file(jsonl_file, dirname))
            except Exception:
                continue

    all_records.sort(key=lambda r: r.get("started_at") or "", reverse=True)

    _save(all_records)
    return all_records


def load() -> list[dict]:
    """Load persisted records; return empty list if none yet."""
    if not _DATA_FILE.exists():
        return []
    try:
        return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return []


def _save(records: list[dict]) -> None:
    with _lock:
        _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        _DATA_FILE.write_bytes(orjson.dumps(records, option=orjson.OPT_INDENT_2))


def build_stats(records: list[dict]) -> dict:
    """Compute aggregated stats from a list of routine records."""
    total = len(records)
    if total == 0:
        return {
            "total": 0,
            "unique_skills": 0,
            "projects": [],
            "by_skill": [],
            "avg_duration_seconds": None,
            "success_rate": None,
            "by_week": [],
        }

    # Per-skill counts
    skill_counts: dict[str, int] = {}
    for r in records:
        s = r.get("skill") or "unknown"
        skill_counts[s] = skill_counts.get(s, 0) + 1
    by_skill = sorted(
        [{"skill": k, "count": v} for k, v in skill_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )

    # Per-project counts
    project_counts: dict[str, int] = {}
    for r in records:
        p = r.get("project") or r.get("project_dir", "unknown")
        project_counts[p] = project_counts.get(p, 0) + 1
    projects = sorted(
        [{"project": k, "count": v} for k, v in project_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )

    # Average duration
    durations = [r["duration_seconds"] for r in records if r.get("duration_seconds") is not None]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else None

    # Success rate
    success_count = sum(1 for r in records if r.get("status") == "success")
    success_rate = round(success_count / total * 100, 1) if total else None

    # By ISO week
    week_counts: dict[str, int] = {}
    for r in records:
        ts = r.get("started_at")
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            week_key = dt.strftime("%Y-W%V")
            week_counts[week_key] = week_counts.get(week_key, 0) + 1
        except Exception:
            continue
    by_week = sorted(
        [{"week": k, "count": v} for k, v in week_counts.items()],
        key=lambda x: x["week"],
    )

    return {
        "total": total,
        "unique_skills": len(skill_counts),
        "projects": projects,
        "by_skill": by_skill,
        "avg_duration_seconds": avg_duration,
        "success_rate": success_rate,
        "by_week": by_week,
    }


def scan_all_background() -> None:
    """Run scan_all() in a daemon thread (called at app startup)."""
    t = threading.Thread(target=scan_all, daemon=True, name="routines-scanner")
    t.start()
