from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.config import CODEX_DIR

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "codex_cli_sessions.json"
_lock = threading.Lock()


def _parse_ts(ts_str: str | None) -> datetime | None:
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except Exception:
        return None


def _scan_file(path: Path) -> dict | None:
    rel = str(path.relative_to(CODEX_DIR))
    record: dict = {
        "session_id": None,
        "filepath": rel,
        "cwd": None,
        "project": "",
        "git_branch": None,
        "git_repo": None,
        "model": None,
        "model_provider": None,
        "cli_version": None,
        "source": None,
        "first_ts": None,
        "last_ts": None,
        "duration_seconds": None,
        "tool_calls": {},
        "total_tool_calls": 0,
        "user_turn_count": 0,
        "agent_turn_count": 0,
        "task_text": "",
    }

    try:
        with open(path, "rb") as f:
            lines = [orjson.loads(line) for line in f if line.strip()]
    except Exception:
        return None

    if not lines:
        return None

    record["first_ts"] = lines[0].get("timestamp")
    record["last_ts"] = lines[-1].get("timestamp")

    first_dt = _parse_ts(record["first_ts"])
    last_dt = _parse_ts(record["last_ts"])
    if first_dt and last_dt:
        record["duration_seconds"] = (last_dt - first_dt).total_seconds()

    for event in lines:
        etype = event.get("type")
        payload = event.get("payload") or {}

        if etype == "session_meta":
            record["session_id"] = payload.get("id")
            record["cwd"] = payload.get("cwd")
            record["cli_version"] = payload.get("cli_version")
            record["source"] = payload.get("source")
            record["model_provider"] = payload.get("model_provider")
            git = payload.get("git") or {}
            record["git_branch"] = git.get("branch")
            record["git_repo"] = git.get("repository_url")
            cwd = payload.get("cwd") or ""
            record["project"] = os.path.basename(cwd) if cwd else ""

        elif etype == "turn_context":
            if record["model"] is None:
                record["model"] = payload.get("model")

        elif etype == "response_item":
            role = payload.get("role")
            if role == "user":
                record["user_turn_count"] += 1
            elif role == "assistant":
                record["agent_turn_count"] += 1

            if payload.get("type") == "function_call":
                name = payload.get("name") or "unknown"
                record["tool_calls"][name] = record["tool_calls"].get(name, 0) + 1

        elif etype == "event_msg":
            msg_type = payload.get("type")
            if msg_type == "user_message" and not record["task_text"]:
                text = payload.get("message") or ""
                record["task_text"] = text[:500]

    record["total_tool_calls"] = sum(record["tool_calls"].values())

    if not record["session_id"]:
        stem = path.stem  # rollout-YYYY-MM-DDTHH-MM-SS-<uuid>
        parts = stem.split("-", 4)
        if len(parts) >= 5:
            record["session_id"] = parts[4]

    return record


def scan_all() -> list[dict]:
    sessions_dir = CODEX_DIR / "sessions"
    if not sessions_dir.exists():
        return []

    results = []
    for jsonl_file in sorted(sessions_dir.rglob("rollout-*.jsonl")):
        rec = _scan_file(jsonl_file)
        if rec:
            results.append(rec)

    results.sort(key=lambda r: r["first_ts"] or "", reverse=True)

    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        _DATA_FILE.write_bytes(orjson.dumps(results, option=orjson.OPT_INDENT_2))

    return results


def load() -> list[dict]:
    if not _DATA_FILE.exists():
        return []
    try:
        with _lock:
            return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return []


def build_stats(sessions: list[dict], days: int | None = 30) -> dict:
    from datetime import timedelta

    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        sessions = [
            s for s in sessions
            if (_parse_ts(s.get("first_ts")) or datetime.min.replace(tzinfo=timezone.utc)) >= cutoff
        ]

    total_sessions = len(sessions)
    total_tool_calls = sum(s.get("total_tool_calls", 0) for s in sessions)
    active_dates = set()
    durations = [s["duration_seconds"] for s in sessions if s.get("duration_seconds") is not None]
    avg_duration = sum(durations) / len(durations) if durations else None

    by_date: dict[str, dict] = {}
    by_hour: dict[int, int] = {h: 0 for h in range(24)}
    tool_totals: dict[str, int] = {}
    model_counts: dict[str, int] = {}
    project_sessions: dict[str, int] = {}
    project_tools: dict[str, int] = {}

    for s in sessions:
        dt = _parse_ts(s.get("first_ts"))
        if dt:
            date_str = dt.strftime("%Y-%m-%d")
            active_dates.add(date_str)
            bucket = by_date.setdefault(date_str, {"date": date_str, "sessions": 0, "tool_calls": 0})
            bucket["sessions"] += 1
            bucket["tool_calls"] += s.get("total_tool_calls", 0)
            by_hour[dt.hour] = by_hour.get(dt.hour, 0) + 1

        for tool, count in (s.get("tool_calls") or {}).items():
            tool_totals[tool] = tool_totals.get(tool, 0) + count

        model = s.get("model") or "unknown"
        model_counts[model] = model_counts.get(model, 0) + 1

        proj = s.get("project") or "unknown"
        project_sessions[proj] = project_sessions.get(proj, 0) + 1
        project_tools[proj] = project_tools.get(proj, 0) + s.get("total_tool_calls", 0)

    sorted_dates = sorted(by_date.values(), key=lambda x: x["date"])
    top_tools = sorted(
        [{"name": k, "count": v} for k, v in tool_totals.items()],
        key=lambda x: x["count"], reverse=True
    )[:10]

    projects = sorted(
        [{"project": k, "sessions": project_sessions[k], "total_tool_calls": project_tools[k]}
         for k in project_sessions],
        key=lambda x: x["sessions"], reverse=True
    )[:10]

    return {
        "overview": {
            "total_sessions": total_sessions,
            "total_tool_calls": total_tool_calls,
            "active_days": len(active_dates),
            "avg_duration_seconds": avg_duration,
        },
        "activity": {
            "by_date": sorted_dates,
            "by_hour": [{"hour": h, "count": by_hour[h]} for h in range(24)],
        },
        "tools": {
            "top_tools": top_tools,
            "total_calls": total_tool_calls,
        },
        "models": [{"model": k, "sessions": v} for k, v in
                   sorted(model_counts.items(), key=lambda x: x[1], reverse=True)],
        "projects": projects,
        "days": days,
        "session_count": total_sessions,
    }


def scan_all_background() -> None:
    t = threading.Thread(target=scan_all, daemon=True, name="codex-cli-scanner")
    t.start()
