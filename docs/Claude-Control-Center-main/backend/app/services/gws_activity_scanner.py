from __future__ import annotations

import hashlib
import json
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.config import CLAUDE_DIR
from app.services import gws_audit

_ACTIVITY_FILE = Path(__file__).parent.parent.parent / "data" / "gws_activity.json"
_GWS_RE = re.compile(r"(?:^|\s)gws\s+([\w+-]+(?:\s+[\w+-]+)*)")
_lock = threading.Lock()

# Interval between background scans (seconds)
_SCAN_INTERVAL = 300  # 5 minutes


# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------

def _extract_service(args_or_command: list[str] | str) -> str:
    if isinstance(args_or_command, list):
        return args_or_command[0] if args_or_command else ""
    m = _GWS_RE.search(args_or_command)
    if m:
        parts = m.group(1).split()
        return parts[0] if parts else ""
    return ""


def _command_summary(args: list[str]) -> str:
    return " ".join(args[:4]) if args else ""


def _record_id(record: dict) -> str:
    key = f"{record.get('source','')}:{record.get('started_at','')}:{record.get('command_summary','')}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _scan_claude_projects() -> list[dict]:
    """Walk ~/.claude/projects/**/*.jsonl and extract gws bash invocations."""
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.exists():
        return []

    records: list[dict] = []

    for jsonl_file in projects_dir.rglob("*.jsonl"):
        session_id = jsonl_file.stem
        # Derive project name from grandparent dir slug
        project_slug = jsonl_file.parent.name
        project = project_slug.replace("-", "/").lstrip("/")

        # First pass: build index of tool_use_id → (timestamp, command, assistant_ts)
        # Second pass: pair with tool_results from user messages
        tool_uses: dict[str, dict] = {}  # tool_use_id → {command, ts}

        try:
            lines = jsonl_file.read_text(errors="ignore").splitlines()
        except Exception:
            continue

        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue

            rtype = rec.get("type")
            ts = rec.get("timestamp", "")

            if rtype == "assistant":
                msg_content = rec.get("message", {}).get("content", [])
                if not isinstance(msg_content, list):
                    continue
                for block in msg_content:
                    if not isinstance(block, dict):
                        continue
                    if block.get("type") == "tool_use" and block.get("name") == "Bash":
                        cmd = block.get("input", {}).get("command", "")
                        if _GWS_RE.search(cmd):
                            tool_uses[block["id"]] = {
                                "command": cmd,
                                "ts": ts,
                                "session_id": session_id,
                                "project": project,
                            }

            elif rtype == "user":
                msg_content = rec.get("message", {}).get("content", [])
                if not isinstance(msg_content, list):
                    continue
                for block in msg_content:
                    if not isinstance(block, dict):
                        continue
                    if block.get("type") == "tool_result":
                        tuid = block.get("tool_use_id", "")
                        if tuid in tool_uses:
                            use = tool_uses.pop(tuid)
                            # Extract output
                            output_snippet = ""
                            result_content = block.get("content", [])
                            if isinstance(result_content, list):
                                for rc in result_content:
                                    if isinstance(rc, dict) and rc.get("type") == "text":
                                        output_snippet = rc.get("text", "")[:500]
                                        break
                            elif isinstance(result_content, str):
                                output_snippet = result_content[:500]

                            # Duration estimate
                            duration_ms = None
                            if use["ts"] and ts:
                                try:
                                    t0 = datetime.fromisoformat(use["ts"].replace("Z", "+00:00"))
                                    t1 = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                                    duration_ms = int((t1 - t0).total_seconds() * 1000)
                                except Exception:
                                    pass

                            m = _GWS_RE.search(use["command"])
                            args = m.group(1).split() if m else []

                            record = {
                                "source": "claude-code",
                                "service": args[0] if args else "",
                                "full_args": args,
                                "command_summary": _command_summary(args),
                                "started_at": use["ts"],
                                "duration_ms": duration_ms,
                                "status": "ok",  # tool_result presence implies completion
                                "output_snippet": output_snippet,
                                "session_id": use["session_id"],
                                "project": use["project"],
                            }
                            record["id"] = _record_id(record)
                            records.append(record)

        # Any remaining unmatched tool_uses (no result yet)
        for tuid, use in tool_uses.items():
            m = _GWS_RE.search(use["command"])
            args = m.group(1).split() if m else []
            record = {
                "source": "claude-code",
                "service": args[0] if args else "",
                "full_args": args,
                "command_summary": _command_summary(args),
                "started_at": use["ts"],
                "duration_ms": None,
                "status": "unknown",
                "output_snippet": "",
                "session_id": use["session_id"],
                "project": use["project"],
            }
            record["id"] = _record_id(record)
            records.append(record)

    return records


def _audit_to_activity(audit_record: dict) -> dict:
    """Convert a gws_audit record to unified activity format."""
    return {
        "id": _record_id({
            "source": audit_record.get("source", ""),
            "started_at": audit_record.get("ts", ""),
            "command_summary": _command_summary(audit_record.get("full_args", [])),
        }),
        "source": audit_record.get("source", "manual"),
        "service": audit_record.get("service", ""),
        "full_args": audit_record.get("full_args", []),
        "command_summary": _command_summary(audit_record.get("full_args", [])),
        "started_at": audit_record.get("ts", ""),
        "duration_ms": audit_record.get("duration_ms"),
        "status": "ok" if audit_record.get("returncode", 0) == 0 else "error",
        "output_snippet": audit_record.get("output_snippet", ""),
        "session_id": None,
        "project": None,
    }


def scan() -> list[dict]:
    """Scan all sources and return merged, deduplicated, time-sorted activity."""
    claude_records = _scan_claude_projects()
    audit_records = [_audit_to_activity(r) for r in gws_audit.load(limit=500)
                     if r.get("source") not in ("snapshot",)]

    # Deduplicate by id — prefer audit records over scanner records for same command
    seen: dict[str, dict] = {}
    for r in audit_records:
        seen[r["id"]] = r
    for r in claude_records:
        if r["id"] not in seen:
            seen[r["id"]] = r

    merged = sorted(seen.values(), key=lambda r: r.get("started_at") or "", reverse=True)

    with _lock:
        _ACTIVITY_FILE.parent.mkdir(parents=True, exist_ok=True)
        _ACTIVITY_FILE.write_bytes(orjson.dumps({
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "records": merged,
        }, option=orjson.OPT_INDENT_2))

    return merged


def load() -> dict:
    with _lock:
        if not _ACTIVITY_FILE.exists():
            return {"scanned_at": None, "records": []}
        try:
            return orjson.loads(_ACTIVITY_FILE.read_bytes())
        except Exception:
            return {"scanned_at": None, "records": []}


def start_background_scan() -> None:
    def _worker():
        time.sleep(10)  # let startup finish first
        while True:
            try:
                scan()
            except Exception:
                pass
            time.sleep(_SCAN_INTERVAL)

    t = threading.Thread(target=_worker, daemon=True, name="gws-activity-scan")
    t.start()
