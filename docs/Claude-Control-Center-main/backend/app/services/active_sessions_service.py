"""Reusable helpers for enumerating active CLI sessions across all agents.

The primary `/api/active-sessions` endpoint (Sidebar / badge) consumes Claude-only
data via `list_claude_sessions()`. The dashboard's fleet endpoint additionally
calls `list_recent_sessions()` to surface Codex CLI + Gemini sessions whose
last activity was inside the recency window.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.config import CLAUDE_DIR


_RECENT_WINDOW_SECONDS = 30 * 60  # 30 minutes


def _count_project_mcp_servers(cwd: str | None) -> int:
    if not cwd:
        return 0
    project_claude = Path(cwd) / ".claude"
    count = 0
    for filename in ("settings.json", "settings.local.json"):
        p = project_claude / filename
        if p.exists():
            try:
                data = orjson.loads(p.read_bytes())
                count += len(data.get("mcpServers", {}))
            except Exception:
                pass
    return count


def list_claude_sessions() -> list[dict]:
    """Return live + dead Claude CLI session records.

    Mirrors the legacy `/api/active-sessions` shape so existing consumers
    (Sidebar, ActiveSessionBadge, DashboardPage hero) keep working.
    """
    sessions_dir = CLAUDE_DIR / "sessions"
    if not sessions_dir.is_dir():
        return []

    results: list[dict] = []
    for p in sessions_dir.glob("*.json"):
        try:
            data = orjson.loads(p.read_bytes())
        except Exception:
            continue
        pid = data.get("pid")
        is_alive = False
        if pid:
            try:
                is_alive = os.path.exists(f"/proc/{pid}")
            except Exception:
                pass
        results.append({
            **data,
            "isAlive": is_alive,
            "additionalMcpServers": _count_project_mcp_servers(data.get("cwd")),
            "bridgeSessionId": data.get("bridgeSessionId"),
        })

    results.sort(key=lambda x: x.get("startedAt", 0), reverse=True)
    return results


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        return datetime.fromisoformat(ts)
    except Exception:
        return None


def _is_recent(last_ts_iso: str | None) -> bool:
    dt = _parse_iso(last_ts_iso)
    if dt is None:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt
    return 0 <= delta.total_seconds() <= _RECENT_WINDOW_SECONDS


def _normalize_codex_cli(session: dict) -> dict | None:
    """Shape a Codex CLI scanner record into the active-session row format."""
    last_ts = session.get("last_ts")
    started_dt = _parse_iso(session.get("first_ts"))
    started_at_ms = int(started_dt.timestamp() * 1000) if started_dt else 0
    return {
        "agent": "codex",
        "kind": "codex-cli",
        "pid": 0,
        "sessionId": session.get("session_id") or "",
        "cwd": session.get("cwd") or "",
        "project": session.get("project") or "",
        "startedAt": started_at_ms,
        "isAlive": _is_recent(last_ts),
        "lastTs": last_ts,
        "model": session.get("model"),
    }


def _normalize_gemini(session: dict) -> dict | None:
    last_ts = session.get("last_ts")
    started_dt = _parse_iso(session.get("first_ts"))
    started_at_ms = int(started_dt.timestamp() * 1000) if started_dt else 0
    return {
        "agent": "gemini",
        "kind": "gemini",
        "pid": 0,
        "sessionId": session.get("session_id") or "",
        "cwd": session.get("cwd") or "",
        "project": session.get("project") or "",
        "startedAt": started_at_ms,
        "isAlive": _is_recent(last_ts),
        "lastTs": last_ts,
        "model": session.get("model"),
    }


def list_recent_sessions_all_agents() -> list[dict]:
    """Return Claude + Codex CLI + Gemini sessions for the dashboard table.

    Claude rows come from the live PID-checked sessions store. Codex CLI and
    Gemini rows are filtered to those whose `last_ts` falls inside the recency
    window. Each row carries a uniform shape:

        { agent, kind, pid, sessionId, cwd, project, startedAt,
          isAlive, lastTs?, model?, bridgeSessionId? }
    """
    rows: list[dict] = []

    for s in list_claude_sessions():
        rows.append({
            "agent": "claude",
            "kind": s.get("kind") or "claude",
            "pid": s.get("pid") or 0,
            "sessionId": s.get("sessionId") or "",
            "cwd": s.get("cwd") or "",
            "project": Path(s.get("cwd") or "").name or "",
            "startedAt": s.get("startedAt") or 0,
            "isAlive": bool(s.get("isAlive")),
            "bridgeSessionId": s.get("bridgeSessionId"),
            "model": s.get("model"),
        })

    try:
        from app.services import codex_cli_session_scanner

        for s in codex_cli_session_scanner.load():
            if _is_recent(s.get("last_ts")):
                row = _normalize_codex_cli(s)
                if row is not None:
                    rows.append(row)
    except Exception:
        pass

    try:
        from app.services import gemini_session_scanner

        for s in gemini_session_scanner.get_sessions():
            if _is_recent(s.get("last_ts")):
                row = _normalize_gemini(s)
                if row is not None:
                    rows.append(row)
    except Exception:
        pass

    rows.sort(key=lambda r: r.get("startedAt") or 0, reverse=True)
    return rows
