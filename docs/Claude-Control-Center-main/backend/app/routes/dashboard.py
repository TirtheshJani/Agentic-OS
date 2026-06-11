"""Aggregated data for the Command Center landing page.

Combines per-agent fleet stats (Claude / Codex CLI / Gemini) with a unified
multi-agent active-sessions list. Reads the cached stats produced by the
background scanners — cheap (file read + small arithmetic).
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify

from app.services import (
    active_sessions_service,
    analytics_service,
    codex_cli_session_scanner,
    gemini_session_scanner,
)

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


def _last_7_days(today: datetime | None = None) -> list[str]:
    if today is None:
        today = datetime.now(timezone.utc)
    return [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]


def _pad_sparkline(values_by_date: dict[str, int], dates: list[str]) -> list[int]:
    return [int(values_by_date.get(d, 0)) for d in dates]


def _claude_agent_block(dates: list[str]) -> dict:
    sessions = active_sessions_service.list_claude_sessions()
    active = sum(1 for s in sessions if s.get("isAlive"))
    idle = len(sessions) - active

    summaries = analytics_service.load()
    stats = analytics_service.build_stats(summaries, days=7)

    by_day = stats.get("tokens", {}).get("by_day", []) or []
    tokens_per_day: dict[str, int] = {
        row["date"]: int(row.get("input", 0)) + int(row.get("output", 0))
        for row in by_day
    }
    sparkline = _pad_sparkline(tokens_per_day, dates)
    tokens_24h = sparkline[-1] if sparkline else 0
    tokens_7d = sum(sparkline)

    return {
        "id": "claude",
        "label": "Claude Code",
        "active": active,
        "queued": 0,
        "failed": 0,
        "idle": idle,
        "value_24h": tokens_24h,
        "value_7d": tokens_7d,
        "value_unit": "tokens",
        "sparkline": sparkline,
        "session_count_7d": int(stats.get("overview", {}).get("total_sessions", 0)),
    }


def _scanner_agent_block(
    agent_id: str,
    label: str,
    sessions: list[dict],
    stats: dict,
    dates: list[str],
) -> dict:
    active = sum(
        1 for s in sessions if active_sessions_service._is_recent(s.get("last_ts"))
    )
    total_7d = int(stats.get("overview", {}).get("total_sessions", 0))
    idle = max(total_7d - active, 0)

    by_date = stats.get("activity", {}).get("by_date", []) or []
    tool_calls_per_day: dict[str, int] = {
        row["date"]: int(row.get("tool_calls", 0)) for row in by_date
    }
    sparkline = _pad_sparkline(tool_calls_per_day, dates)
    value_24h = sparkline[-1] if sparkline else 0
    value_7d = sum(sparkline)

    return {
        "id": agent_id,
        "label": label,
        "active": active,
        "queued": 0,
        "failed": 0,
        "idle": idle,
        "value_24h": value_24h,
        "value_7d": value_7d,
        "value_unit": "tool calls",
        "sparkline": sparkline,
        "session_count_7d": total_7d,
    }


@bp.get("/fleet")
def get_fleet():
    dates = _last_7_days()

    claude = _claude_agent_block(dates)

    codex_sessions = codex_cli_session_scanner.load()
    codex_stats = codex_cli_session_scanner.build_stats(codex_sessions, days=7)
    codex = _scanner_agent_block("codex", "Codex CLI", codex_sessions, codex_stats, dates)

    gemini_sessions = gemini_session_scanner.get_sessions()
    gemini_stats = gemini_session_scanner.get_stats(gemini_sessions, days=7)
    gemini = _scanner_agent_block("gemini", "Gemini CLI", gemini_sessions, gemini_stats, dates)

    agents = [claude, codex, gemini]

    return jsonify({
        "agents": agents,
        "active_sessions": active_sessions_service.list_recent_sessions_all_agents(),
        "dates": dates,
        "generated_at": int(time.time()),
    })
