from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from pathlib import Path
import orjson

from app.config import ANTIGRAVITY_DIR

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "antigravity_sessions.json"
_lock = threading.Lock()
_SCAN_INTERVAL = 300

def _parse_ts(ts_val) -> datetime | None:
    if not ts_val:
        return None
    try:
        # if ms timestamp
        if isinstance(ts_val, (int, float)):
            if ts_val > 1e11:
                return datetime.fromtimestamp(ts_val / 1000, tz=timezone.utc)
            return datetime.fromtimestamp(ts_val, tz=timezone.utc)
        return datetime.fromisoformat(str(ts_val).replace("Z", "+00:00"))
    except Exception:
        return None

def scan_all() -> list[dict]:
    history_file = ANTIGRAVITY_DIR / "history.jsonl"
    if not history_file.exists():
        return []

    sessions = []
    seen_ids = set()
    
    try:
        lines = history_file.read_bytes().splitlines()
    except Exception:
        return []

    # Read backward so latest shows up
    for line in reversed(lines):
        if not line.strip():
            continue
        try:
            record = orjson.loads(line)
        except Exception:
            continue
            
        conv_id = record.get("conversationId")
        if not conv_id or conv_id in seen_ids:
            continue
            
        seen_ids.add(conv_id)
        
        # Read the transcript for metrics
        transcript_file = ANTIGRAVITY_DIR / "brain" / conv_id / ".system_generated" / "logs" / "transcript.jsonl"
        user_turns = 0
        agent_turns = 0
        tool_calls_count = 0
        tool_calls = {}
        first_ts = record.get("timestamp")
        last_ts = first_ts
        
        if transcript_file.exists():
            try:
                t_lines = transcript_file.read_bytes().splitlines()
                for t_line in t_lines:
                    if not t_line.strip():
                        continue
                    try:
                        t_rec = orjson.loads(t_line)
                    except Exception:
                        continue
                        
                    src = t_rec.get("source")
                    if src == "USER_EXPLICIT":
                        user_turns += 1
                    elif src == "MODEL":
                        agent_turns += 1
                        
                    tcs = t_rec.get("tool_calls", [])
                    if tcs:
                        for tc in tcs:
                            name = tc.get("name", "unknown")
                            tool_calls[name] = tool_calls.get(name, 0) + 1
                            tool_calls_count += 1
                            
                    dt = t_rec.get("created_at")
                    if dt:
                        dt_parsed = _parse_ts(dt)
                        if dt_parsed:
                            if not first_ts:
                                first_ts = dt_parsed.timestamp() * 1000
                            last_ts = dt_parsed.timestamp() * 1000
            except Exception:
                pass
                
        first_dt = _parse_ts(first_ts)
        last_dt = _parse_ts(last_ts)
        dur = 0
        if first_dt and last_dt:
            dur = (last_dt - first_dt).total_seconds()

        sessions.append({
            "session_id": conv_id,
            "project": os.path.basename(record.get("workspace", "")),
            "cwd": record.get("workspace"),
            "task_text": record.get("display", ""),
            "first_ts": first_dt.isoformat() if first_dt else None,
            "last_ts": last_dt.isoformat() if last_dt else None,
            "duration_seconds": dur,
            "user_turn_count": user_turns,
            "agent_turn_count": agent_turns,
            "total_tool_calls": tool_calls_count,
            "tool_calls": tool_calls,
        })
        
    sessions.sort(key=lambda x: x.get("first_ts") or "", reverse=True)
    
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        _DATA_FILE.write_bytes(orjson.dumps(sessions, option=orjson.OPT_INDENT_2))
        
    return sessions

def get_sessions() -> list[dict]:
    if not _DATA_FILE.exists():
        return []
    try:
        with _lock:
            return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return []

def get_session_events(session_id: str) -> list[dict]:
    transcript_file = ANTIGRAVITY_DIR / "brain" / session_id / ".system_generated" / "logs" / "transcript.jsonl"
    if not transcript_file.exists():
        return []
        
    events = []
    try:
        lines = transcript_file.read_bytes().splitlines()
    except Exception:
        return []
        
    for line in lines:
        if not line.strip():
            continue
        try:
            rec = orjson.loads(line)
        except Exception:
            continue
            
        ts = rec.get("created_at")
        src = rec.get("source")
        type_ = rec.get("type")
        
        if src == "USER_EXPLICIT" and type_ == "USER_INPUT":
            events.append({
                "type": "event_msg",
                "timestamp": ts,
                "payload": {"type": "user_message", "message": rec.get("content", ""), "role": "user"}
            })
        elif src == "MODEL":
            if type_ == "PLANNER_RESPONSE":
                tcs = rec.get("tool_calls", [])
                for tc in tcs:
                    name = tc.get("name", "unknown")
                    args = tc.get("args", {})
                    import json
                    args_str = json.dumps(args) if isinstance(args, dict) else str(args)
                    events.append({
                        "type": "response_item",
                        "timestamp": ts,
                        "payload": {"type": "function_call", "name": name, "arguments": args_str}
                    })
                # Add thinking
                thinking = rec.get("thinking")
                if thinking:
                     events.append({
                         "type": "event_msg",
                         "timestamp": ts,
                         "payload": {"type": "agent_message", "message": f"<thought>{thinking}</thought>", "role": "assistant"}
                     })
            elif type_ != "PLANNER_RESPONSE":
                # For step types like tool responses or content, we might not render them exactly the same, 
                # but we can try to extract content if present
                content = rec.get("content", "")
                if content:
                     events.append({
                         "type": "event_msg",
                         "timestamp": ts,
                         "payload": {"type": "agent_message", "message": content[:500] + ("..." if len(content)>500 else ""), "role": "system"}
                     })
                     
    return events

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
            time.sleep(_SCAN_INTERVAL)

    t = threading.Thread(target=_worker, daemon=True, name="antigravity-session-scanner")
    t.start()
