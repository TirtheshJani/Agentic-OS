"""
Advisor tool usage tracker.

Scans all session JSONL files under ~/.claude/projects/ for server_tool_use
blocks of type advisor_20260301. Pairs each invocation with its subsequent
advisor_tool_result to capture advice text and duration.

Records are stored in backend/data/advisor_usages.json.
"""
from __future__ import annotations

import threading
from datetime import datetime
from pathlib import Path

import orjson

from app.config import CLAUDE_DIR
from app.services.project_decoder import decode_project_dir, display_name

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "advisor_usages.json"
_MAX_ADVICE_BYTES = 4096

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
    """Pull plain text out of an advisor_tool_result content field."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") in ("advisor_result", "advisor_redacted_result"):
                    parts.append(block.get("text", block.get("content", "")))
                elif isinstance(block.get("content"), str):
                    parts.append(block["content"])
        return "\n".join(parts)
    if isinstance(content, dict):
        if content.get("type") in ("advisor_result", "advisor_redacted_result"):
            return content.get("text", content.get("content", ""))
    return ""


def _scan_file(jsonl_path: Path, project_dirname: str) -> list[dict]:
    """Return advisor invocation records from a single JSONL file."""
    records: list[dict] = []
    messages = list(_iter_raw(jsonl_path))

    # Index advisor_tool_result blocks by tool_use_id
    result_map: dict[str, dict] = {}
    for msg in messages:
        content = msg.get("message", {}).get("content") or msg.get("content") or []
        if isinstance(content, str):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "advisor_tool_result":
                tid = block.get("tool_use_id")
                if tid:
                    result_map[tid] = {
                        "timestamp": msg.get("timestamp"),
                        "content": block.get("content", ""),
                        "error": block.get("error"),
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

        executor_model = msg.get("message", {}).get("model") or msg.get("model")
        advisor_model_top = msg.get("advisorModel")

        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") != "server_tool_use":
                continue
            # Check if this is an advisor tool invocation
            tool_name = block.get("name", "")
            if tool_name != "advisor":
                continue

            tool_use_id = block.get("id", "")
            started_at = msg.get("timestamp")
            advisor_model = advisor_model_top or block.get("model") or block.get("input", {}).get("model")

            result = result_map.get(tool_use_id)
            ended_at = result["timestamp"] if result else None
            raw_advice = _extract_text(result["content"]) if result else ""
            advice_text = raw_advice[:_MAX_ADVICE_BYTES] if raw_advice else ""
            has_error = bool(result.get("error")) if result else False

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
                "started_at": started_at,
                "ended_at": ended_at,
                "duration_seconds": duration_seconds,
                "executor_model": executor_model,
                "advisor_model": advisor_model,
                "advice_text": advice_text,
                "status": "error" if has_error else ("success" if result else "unknown"),
            })

    return records


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scan_all() -> list[dict]:
    """Scan every session JSONL in ~/.claude/projects/ and return all advisor records."""
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
    """Compute aggregated stats from a list of records."""
    total = len(records)
    if total == 0:
        return {
            "total": 0,
            "projects": [],
            "model_pairs": [],
            "avg_duration_seconds": None,
            "success_rate": None,
            "by_week": [],
        }

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

    # Per model-pair counts
    pair_counts: dict[str, int] = {}
    for r in records:
        executor = r.get("executor_model") or "unknown"
        advisor = r.get("advisor_model") or "unknown"
        pair_key = f"{executor} -> {advisor}"
        pair_counts[pair_key] = pair_counts.get(pair_key, 0) + 1
    model_pairs = sorted(
        [{"pair": k, "count": v} for k, v in pair_counts.items()],
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
        "projects": projects,
        "model_pairs": model_pairs,
        "avg_duration_seconds": avg_duration,
        "success_rate": success_rate,
        "by_week": by_week,
    }


def scan_all_background() -> None:
    """Run scan_all() in a daemon thread (called at app startup)."""
    t = threading.Thread(target=scan_all, daemon=True, name="advisor-scanner")
    t.start()
