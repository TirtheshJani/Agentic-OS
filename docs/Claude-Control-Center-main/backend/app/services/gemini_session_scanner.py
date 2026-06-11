from __future__ import annotations

"""Scanner for Gemini CLI session files. Mirrors codex_cli_session_scanner.py."""

import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import orjson

_GEMINI_DIR = Path(os.getenv("GEMINI_DIR", str(Path.home() / ".gemini")))
_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "gemini_sessions.json"
_lock = threading.Lock()
_SCAN_INTERVAL = 300  # 5 minutes


def _parse_ts(ts_str: str | None) -> datetime | None:
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
    except Exception:
        pass
    # Try unix timestamp
    try:
        return datetime.fromtimestamp(float(ts_str), tz=timezone.utc)
    except Exception:
        return None


def _parse_session_file(path: Path) -> dict | None:
    """Leniently parse a Gemini session JSON file."""
    try:
        raw = path.read_bytes()
        data = orjson.loads(raw)
    except Exception:
        return None

    if not data:
        return None

    record: dict = {
        "session_id": None,
        "filepath": str(path.relative_to(_GEMINI_DIR)) if path.is_relative_to(_GEMINI_DIR) else str(path),
        "cwd": None,
        "project": "",
        "model": None,
        "first_ts": None,
        "last_ts": None,
        "duration_seconds": None,
        "tool_calls": {},
        "total_tool_calls": 0,
        "user_turn_count": 0,
        "agent_turn_count": 0,
        "task_text": "",
    }

    # Handle array of log entries vs single object
    entries: list[dict] = []
    if isinstance(data, list):
        entries = [e for e in data if isinstance(e, dict)]
    elif isinstance(data, dict):
        # Could be a session object directly or wrap entries
        for key in ("logs", "events", "messages", "turns"):
            if isinstance(data.get(key), list):
                entries = data[key]
                break
        if not entries:
            entries = [data]

    if not entries:
        return None

    # Extract timestamps
    all_ts = []
    for entry in entries:
        for ts_key in ("timestamp", "ts", "created_at", "time"):
            val = entry.get(ts_key)
            if val:
                dt = _parse_ts(str(val))
                if dt:
                    all_ts.append(dt)
                    break

    if all_ts:
        all_ts.sort()
        record["first_ts"] = all_ts[0].isoformat()
        record["last_ts"] = all_ts[-1].isoformat()
        record["duration_seconds"] = (all_ts[-1] - all_ts[0]).total_seconds()

    # Extract fields from entries
    for entry in entries:
        # Session ID
        for id_key in ("session_id", "id", "sessionId", "uuid"):
            v = entry.get(id_key)
            if v and isinstance(v, str) and record["session_id"] is None:
                record["session_id"] = v
                break

        # CWD / project
        for cwd_key in ("cwd", "working_directory", "workingDir"):
            v = entry.get(cwd_key)
            if v and record["cwd"] is None:
                record["cwd"] = str(v)
                record["project"] = os.path.basename(str(v))
                break

        # Model
        for model_key in ("model", "model_name", "modelName"):
            v = entry.get(model_key)
            if v and record["model"] is None:
                record["model"] = str(v)
                break

        # Role / turn counting
        role = entry.get("role") or entry.get("type") or ""
        if role in ("user", "human"):
            record["user_turn_count"] += 1
            text = entry.get("content") or entry.get("text") or entry.get("message") or ""
            if isinstance(text, str) and text and not record["task_text"]:
                record["task_text"] = text[:500]
        elif role in ("assistant", "model", "gemini", "agent"):
            record["agent_turn_count"] += 1

        # Tool calls
        for tc_key in ("tool_calls", "toolCalls", "function_calls"):
            tc = entry.get(tc_key)
            if isinstance(tc, list):
                for call in tc:
                    if isinstance(call, dict):
                        name = call.get("name") or call.get("function") or "unknown"
                        record["tool_calls"][name] = record["tool_calls"].get(name, 0) + 1
                break
            elif isinstance(tc, dict):
                name = tc.get("name") or "unknown"
                record["tool_calls"][name] = record["tool_calls"].get(name, 0) + 1
                break

    record["total_tool_calls"] = sum(record["tool_calls"].values())

    # Fallback session_id from stem
    if not record["session_id"]:
        record["session_id"] = path.stem

    return record


def _parse_session_jsonl(path: Path) -> dict | None:
    """Parse a Gemini session JSONL file (one JSON object per line)."""
    record: dict = {
        "session_id": None,
        "filepath": str(path.relative_to(_GEMINI_DIR)) if path.is_relative_to(_GEMINI_DIR) else str(path),
        "cwd": None,
        "project": "",
        "model": None,
        "first_ts": None,
        "last_ts": None,
        "duration_seconds": None,
        "tool_calls": {},
        "total_tool_calls": 0,
        "user_turn_count": 0,
        "agent_turn_count": 0,
        "task_text": "",
    }
    all_ts: list = []
    try:
        lines = path.read_bytes().splitlines()
    except Exception:
        return None
    if not lines:
        return None

    for raw_line in lines:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            entry = orjson.loads(raw_line)
        except Exception:
            continue
        if not isinstance(entry, dict):
            continue

        # Session ID — first line usually has sessionId
        if record["session_id"] is None:
            for id_key in ("sessionId", "session_id", "id", "uuid"):
                v = entry.get(id_key)
                if v and isinstance(v, str):
                    record["session_id"] = v
                    break

        # Timestamps
        for ts_key in ("timestamp", "ts", "created_at", "time", "startTime", "lastUpdated"):
            val = entry.get(ts_key)
            if val:
                dt = _parse_ts(str(val))
                if dt:
                    all_ts.append(dt)
                    break

        # CWD / project
        for cwd_key in ("cwd", "working_directory", "workingDir"):
            v = entry.get(cwd_key)
            if v and record["cwd"] is None:
                record["cwd"] = str(v)
                record["project"] = os.path.basename(str(v))
                break

        # Model
        for model_key in ("model", "model_name", "modelName"):
            v = entry.get(model_key)
            if v and record["model"] is None:
                record["model"] = str(v)
                break

        # Role / turn counting
        role = entry.get("role") or entry.get("type") or ""
        if role in ("user", "human"):
            record["user_turn_count"] += 1
            text = entry.get("content") or entry.get("text") or entry.get("message") or ""
            if isinstance(text, list):
                text = " ".join(p.get("text", "") for p in text if isinstance(p, dict))
            if isinstance(text, str) and text and not record["task_text"]:
                record["task_text"] = text[:500]
        elif role in ("assistant", "model", "gemini", "agent"):
            record["agent_turn_count"] += 1

        # Tool calls
        for tc_key in ("tool_calls", "toolCalls", "function_calls", "functionCalls"):
            tc = entry.get(tc_key)
            if isinstance(tc, list):
                for call in tc:
                    if isinstance(call, dict):
                        name = call.get("name") or call.get("function") or "unknown"
                        record["tool_calls"][name] = record["tool_calls"].get(name, 0) + 1
                break
            elif isinstance(tc, dict):
                name = tc.get("name") or "unknown"
                record["tool_calls"][name] = record["tool_calls"].get(name, 0) + 1
                break

    if not record["session_id"]:
        record["session_id"] = path.stem

    # Derive project from path if not found in content
    if not record["project"]:
        # tmp/<project>/chats/session-*.jsonl → project = path.parent.parent.name
        record["project"] = path.parent.parent.name if path.parent.name == "chats" else path.parent.name

    if all_ts:
        all_ts.sort()
        record["first_ts"] = all_ts[0].isoformat()
        record["last_ts"] = all_ts[-1].isoformat()
        record["duration_seconds"] = (all_ts[-1] - all_ts[0]).total_seconds()

    record["total_tool_calls"] = sum(record["tool_calls"].values())
    return record


def get_session_events(session_id: str) -> list[dict]:
    """Read a session's JSONL file and return structured events for the transcript view."""
    sessions = get_sessions()
    session = next((s for s in sessions if s.get("session_id") == session_id), None)
    if not session:
        return []
    filepath = session.get("filepath", "")
    if not filepath:
        return []

    # filepath is relative to _GEMINI_DIR
    path = (_GEMINI_DIR / filepath) if not os.path.isabs(filepath) else Path(filepath)
    if not path.exists():
        return []

    events: list[dict] = []
    try:
        lines = path.read_bytes().splitlines()
    except Exception:
        return []

    for raw_line in lines:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            entry = orjson.loads(raw_line)
        except Exception:
            continue
        if not isinstance(entry, dict):
            continue

        role = entry.get("role") or entry.get("type") or ""
        ts = None
        for ts_key in ("timestamp", "ts", "created_at", "time"):
            val = entry.get(ts_key)
            if val:
                ts = str(val)
                break

        # User message
        if role in ("user", "human"):
            content = entry.get("content") or entry.get("text") or entry.get("message") or ""
            if isinstance(content, list):
                text = " ".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
            else:
                text = str(content)
            events.append({"type": "event_msg", "timestamp": ts or "", "payload": {"type": "user_message", "message": text, "role": "user"}})

        # Agent/model message
        elif role in ("assistant", "model", "gemini", "agent"):
            # Check for tool calls first
            for tc_key in ("tool_calls", "toolCalls", "function_calls", "functionCalls"):
                tc_list = entry.get(tc_key)
                if isinstance(tc_list, list):
                    for call in tc_list:
                        if isinstance(call, dict):
                            name = call.get("name") or call.get("function") or "tool"
                            args = call.get("args") or call.get("arguments") or call.get("input") or {}
                            import json as _json
                            args_str = _json.dumps(args) if isinstance(args, dict) else str(args)
                            events.append({"type": "response_item", "timestamp": ts or "", "payload": {"type": "function_call", "name": name, "arguments": args_str}})
                    break

            # Agent text content
            content = entry.get("content") or entry.get("text") or entry.get("message") or ""
            if isinstance(content, list):
                text = " ".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
            elif isinstance(content, str):
                text = content
            else:
                text = ""
            if text:
                events.append({"type": "event_msg", "timestamp": ts or "", "payload": {"type": "agent_message", "message": text, "role": "assistant"}})

        # Skip metadata-only records (first line with kind/sessionId but no role)
        # These are session init records with no conversation content

    return events


def _scan_dir(subdir: Path) -> list[dict]:
    results = []
    if not subdir.exists():
        return results
    for json_file in subdir.rglob("*.json"):
        rec = _parse_session_file(json_file)
        if rec:
            results.append(rec)
    for jsonl_file in subdir.rglob("*.jsonl"):
        rec = _parse_session_jsonl(jsonl_file)
        if rec:
            results.append(rec)
    return results


def scan_all() -> list[dict]:
    """Scan all Gemini session locations and save to data file."""
    all_results: list[dict] = []
    seen_ids: set[str] = set()

    candidate_dirs = [
        _GEMINI_DIR / "tmp",
        _GEMINI_DIR / "sessions",
        _GEMINI_DIR / "checkpoints",
    ]

    for d in candidate_dirs:
        for rec in _scan_dir(d):
            sid = rec.get("session_id", "")
            if sid and sid not in seen_ids:
                seen_ids.add(sid)
                all_results.append(rec)

    all_results.sort(key=lambda r: r.get("first_ts") or "", reverse=True)

    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        _DATA_FILE.write_bytes(orjson.dumps(all_results, option=orjson.OPT_INDENT_2))

    return all_results


def get_sessions() -> list[dict]:
    if not _DATA_FILE.exists():
        return []
    try:
        with _lock:
            return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return []


def get_stats(sessions: list[dict] | None = None, days: int | None = 30) -> dict:
    from datetime import timedelta
    if sessions is None:
        sessions = get_sessions()

    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        sessions = [
            s for s in sessions
            if (_parse_ts(s.get("first_ts")) or datetime.min.replace(tzinfo=timezone.utc)) >= cutoff
        ]

    total_sessions = len(sessions)
    total_tool_calls = sum(s.get("total_tool_calls", 0) for s in sessions)
    active_dates: set[str] = set()
    durations = [s["duration_seconds"] for s in sessions if s.get("duration_seconds") is not None]
    avg_duration = sum(durations) / len(durations) if durations else None

    by_date: dict[str, dict] = {}
    by_hour: dict[int, int] = {h: 0 for h in range(24)}
    tool_totals: dict[str, int] = {}
    model_counts: dict[str, int] = {}
    project_counts: dict[str, dict] = {}

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
        project = s.get("project") or "unknown"
        pb = project_counts.setdefault(project, {"project": project, "sessions": 0, "total_tool_calls": 0})
        pb["sessions"] += 1
        pb["total_tool_calls"] += s.get("total_tool_calls", 0)

    sorted_dates = sorted(by_date.values(), key=lambda x: x["date"])
    top_tools = sorted(
        [{"name": k, "count": v} for k, v in tool_totals.items()],
        key=lambda x: x["count"], reverse=True,
    )[:10]
    sorted_projects = sorted(project_counts.values(), key=lambda x: x["sessions"], reverse=True)

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
        "tools": {"top_tools": top_tools, "total_calls": total_tool_calls},
        "models": [{"model": k, "sessions": v} for k, v in
                   sorted(model_counts.items(), key=lambda x: x[1], reverse=True)],
        "projects": sorted_projects,
        "days": days,
        "session_count": total_sessions,
    }


def trigger_scan() -> dict:
    sessions = scan_all()
    stats = get_stats(sessions)
    return {"scanned": len(sessions), "stats": stats}


def scan_all_background() -> None:
    def _worker():
        import time
        time.sleep(15)
        while True:
            try:
                scan_all()
            except Exception:
                pass
            import time as _t
            _t.sleep(_SCAN_INTERVAL)

    t = threading.Thread(target=_worker, daemon=True, name="gemini-session-scanner")
    t.start()
