"""Analytics aggregation — roll per-session summaries into dashboard stats.

Pure functions over a list of summaries. ``build_stats`` accepts an optional
``now`` so the day-window filter is deterministic under test.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone


def filter_by_days(summaries: list[dict], days: int | None, *, now: datetime | None = None) -> list[dict]:
    if not days:
        return summaries
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    result = []
    for s in summaries:
        ts = s.get("last_ts") or s.get("first_ts")
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if dt >= cutoff:
                result.append(s)
        except Exception:
            continue
    return result


def generate_insights(sessions: list[dict]) -> list[dict]:
    insights = []
    unplanned = [s for s in sessions if not s.get("has_plan_mode")]

    # Insight 1: Long sessions without plan mode
    long_unplanned = [s for s in unplanned if s.get("message_count", 0) > 15]
    if long_unplanned:
        n = len(long_unplanned)
        insights.append({
            "type": "plan_mode_long_session",
            "title": "Long sessions without plan mode",
            "description": (
                f"{n} session{'s' if n != 1 else ''} had 15+ messages without plan mode "
                f"— planning upfront could make these more focused"
            ),
            "severity": "warning" if n > 3 else "info",
            "data": {"count": n, "threshold": 15},
        })

    # Insight 2: Advisor calls in unplanned sessions
    advisor_unplanned = [s for s in unplanned if s.get("advisor_call_count", 0) >= 2]
    if advisor_unplanned:
        n = len(advisor_unplanned)
        total_calls = sum(s.get("advisor_call_count", 0) for s in advisor_unplanned)
        insights.append({
            "type": "plan_mode_advisor_calls",
            "title": "Advisor calls in unplanned sessions",
            "description": (
                f"You called advisor {total_calls} time{'s' if total_calls != 1 else ''} across "
                f"{n} unplanned session{'s' if n != 1 else ''} "
                f"— these could benefit from /plan first"
            ),
            "severity": "info",
            "data": {"sessions": n, "total_calls": total_calls},
        })

    # Insight 3: High tool-call density without plan mode
    high_density = []
    for s in unplanned:
        mc = s.get("message_count", 0)
        if mc > 0:
            total_tc = sum(s.get("tool_calls", {}).values())
            if total_tc / mc > 3:
                high_density.append(s)
    if high_density:
        n = len(high_density)
        insights.append({
            "type": "plan_mode_tool_density",
            "title": "High tool usage in unplanned sessions",
            "description": (
                f"High tool usage in {n} session{'s' if n != 1 else ''} "
                f"suggests complex tasks that would benefit from an upfront plan"
            ),
            "severity": "info",
            "data": {"count": n, "ratio_threshold": 3},
        })

    # Insight 4: Auto mode usage
    auto_sessions = [s for s in sessions if s.get("has_auto_mode")]
    if auto_sessions:
        n = len(auto_sessions)
        insights.append({
            "type": "feature_auto_mode",
            "title": "Auto mode active",
            "description": (
                f"{n} session{'s' if n != 1 else ''} used auto permission mode "
                f"— Claude handled permission decisions automatically"
            ),
            "severity": "info",
            "data": {"count": n},
        })

    # Insight 5: Ultraplan usage
    ultraplan_sessions = [s for s in sessions if s.get("has_ultraplan")]
    if ultraplan_sessions:
        n = len(ultraplan_sessions)
        insights.append({
            "type": "feature_ultraplan",
            "title": "Ultraplan used",
            "description": (
                f"/ultraplan was invoked in {n} session{'s' if n != 1 else ''} "
                f"— cloud-powered extended planning"
            ),
            "severity": "info",
            "data": {"count": n},
        })

    # Insight 6: Computer use
    cu_sessions = [s for s in sessions if s.get("has_computer_use")]
    if cu_sessions:
        n = len(cu_sessions)
        total_cu = sum(s.get("computer_use_calls", 0) for s in cu_sessions)
        insights.append({
            "type": "feature_computer_use",
            "title": "Computer use detected",
            "description": (
                f"Computer use tools were called {total_cu} time{'s' if total_cu != 1 else ''} "
                f"across {n} session{'s' if n != 1 else ''}"
            ),
            "severity": "info",
            "data": {"sessions": n, "total_calls": total_cu},
        })

    # Insight 7: Verification adoption (Boris tip #6)
    verified = [s for s in sessions if s.get("has_verification")]
    if sessions:
        verify_pct = round(len(verified) / len(sessions) * 100)
        if verify_pct >= 30:
            insights.append({
                "type": "quality_verification",
                "title": "Verification habit detected",
                "description": (
                    f"{verify_pct}% of sessions ran tests or builds to verify work "
                    f"— this is Boris’s top tip for 2-3× output quality"
                ),
                "severity": "info",
                "data": {"pct": verify_pct, "count": len(verified)},
            })
        elif verified:
            insights.append({
                "type": "quality_verification_low",
                "title": "Low verification rate",
                "description": (
                    f"Only {verify_pct}% of sessions ran tests or builds "
                    f"— adding verification steps can 2-3× what you get out of Claude"
                ),
                "severity": "warning",
                "data": {"pct": verify_pct, "count": len(verified)},
            })

    # Insight 8: Sessions with no quality signals at all
    zero_quality = [s for s in sessions if s.get("quality_score", 0) == 0]
    if sessions and len(zero_quality) / len(sessions) > 0.5:
        n = len(zero_quality)
        insights.append({
            "type": "quality_low_overall",
            "title": "Most sessions lack quality signals",
            "description": (
                f"{n} session{'s' if n != 1 else ''} used none of: auto mode, plan mode, or verification "
                f"— try enabling auto mode and running tests to boost session quality"
            ),
            "severity": "warning",
            "data": {"count": n, "total": len(sessions)},
        })

    return insights


def _empty_stats(days: int | None) -> dict:
    return {
        "overview": {
            "total_sessions": 0, "total_messages": 0, "total_tool_calls": 0,
            "plan_sessions": 0, "regular_sessions": 0, "active_days": 0,
        },
        "tokens": {
            "input_tokens": 0, "output_tokens": 0,
            "cache_read_tokens": 0, "cache_creation_tokens": 0,
            "by_day": [],
        },
        "activity": {
            "by_hour": [{"hour": h, "count": 0} for h in range(24)],
            "by_date": [],
        },
        "tools": {"top_tools": [], "total_calls": 0},
        "models": [],
        "projects": [],
        "feature_usage": {
            "auto_mode_sessions": 0,
            "computer_use_sessions": 0,
            "ultraplan_sessions": 0,
            "computer_use_calls": 0,
            "permission_mode_breakdown": {},
        },
        "session_quality": {
            "avg_score": 0,
            "distribution": {"high": 0, "medium": 0, "low": 0},
            "signals": {"verification_pct": 0, "auto_pct": 0, "plan_pct": 0},
            "by_project": [],
        },
        "insights": [],
        "days": days,
        "session_count": 0,
    }


def build_stats(summaries: list[dict], days: int | None = 30, *, now: datetime | None = None) -> dict:
    """Compute aggregated analytics from session summaries."""
    filtered = filter_by_days(summaries, days, now=now)

    if not filtered:
        return _empty_stats(days)

    # Overview
    total_tool_calls = sum(sum(s.get("tool_calls", {}).values()) for s in filtered)
    plan_sessions = sum(1 for s in filtered if s.get("has_plan_mode"))
    active_days = len({(s.get("last_ts") or "")[:10] for s in filtered if s.get("last_ts")})
    overview = {
        "total_sessions": len(filtered),
        "total_messages": sum(s.get("message_count", 0) for s in filtered),
        "total_tool_calls": total_tool_calls,
        "plan_sessions": plan_sessions,
        "regular_sessions": len(filtered) - plan_sessions,
        "active_days": active_days,
    }

    # Tokens
    day_buckets: dict[str, dict] = defaultdict(lambda: {"input": 0, "output": 0, "messages": 0})
    for s in filtered:
        for d in s.get("daily", []):
            day_buckets[d["date"]]["input"] += d.get("input", 0)
            day_buckets[d["date"]]["output"] += d.get("output", 0)
            day_buckets[d["date"]]["messages"] += d.get("messages", 0)
    tokens = {
        "input_tokens": sum(s.get("input_tokens", 0) for s in filtered),
        "output_tokens": sum(s.get("output_tokens", 0) for s in filtered),
        "cache_read_tokens": sum(s.get("cache_read_tokens", 0) for s in filtered),
        "cache_creation_tokens": sum(s.get("cache_creation_tokens", 0) for s in filtered),
        "by_day": sorted(
            [{"date": k, **v} for k, v in day_buckets.items()],
            key=lambda x: x["date"],
        ),
    }

    # Activity
    hour_totals: dict[int, int] = defaultdict(int)
    date_sessions: dict[str, dict] = defaultdict(lambda: {"sessions": 0, "messages": 0})
    for s in filtered:
        for h_str, cnt in s.get("hourly", {}).items():
            hour_totals[int(h_str)] += cnt
        date_key = (s.get("last_ts") or "")[:10]
        if date_key:
            date_sessions[date_key]["sessions"] += 1
            date_sessions[date_key]["messages"] += s.get("message_count", 0)
    activity = {
        "by_hour": [{"hour": h, "count": hour_totals.get(h, 0)} for h in range(24)],
        "by_date": sorted(
            [{"date": k, **v} for k, v in date_sessions.items()],
            key=lambda x: x["date"],
        ),
    }

    # Tools
    tool_totals: dict[str, int] = defaultdict(int)
    for s in filtered:
        for name, cnt in s.get("tool_calls", {}).items():
            tool_totals[name] += cnt
    top_tools = sorted(
        [{"name": k, "count": v} for k, v in tool_totals.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]
    tools = {"top_tools": top_tools, "total_calls": sum(tool_totals.values())}

    # Models
    model_totals: dict[str, dict] = defaultdict(lambda: {"messages": 0, "tokens": 0})
    for s in filtered:
        for model, data in s.get("models", {}).items():
            model_totals[model]["messages"] += data.get("messages", 0)
            model_totals[model]["tokens"] += data.get("tokens", 0)
    models_list = sorted(
        [{"model": k, **v} for k, v in model_totals.items()],
        key=lambda x: x["tokens"],
        reverse=True,
    )

    # Projects
    proj_totals: dict[str, dict] = defaultdict(lambda: {"sessions": 0, "messages": 0, "tokens": 0})
    for s in filtered:
        p = s.get("project", "unknown")
        proj_totals[p]["sessions"] += 1
        proj_totals[p]["messages"] += s.get("message_count", 0)
        proj_totals[p]["tokens"] += s.get("input_tokens", 0) + s.get("output_tokens", 0)
    projects_list = sorted(
        [{"project": k, **v} for k, v in proj_totals.items()],
        key=lambda x: x["messages"],
        reverse=True,
    )[:8]

    # Feature usage
    perm_breakdown: dict[str, int] = defaultdict(int)
    for s in filtered:
        for mode in s.get("permission_modes", []):
            perm_breakdown[mode] += 1
    feature_usage = {
        "auto_mode_sessions": sum(1 for s in filtered if s.get("has_auto_mode")),
        "computer_use_sessions": sum(1 for s in filtered if s.get("has_computer_use")),
        "ultraplan_sessions": sum(1 for s in filtered if s.get("has_ultraplan")),
        "computer_use_calls": sum(s.get("computer_use_calls", 0) for s in filtered),
        "permission_mode_breakdown": dict(perm_breakdown),
    }

    # Session quality aggregation
    quality_scores = [s.get("quality_score", 0) for s in filtered]
    n = len(filtered)
    q_high = sum(1 for q in quality_scores if q >= 67)
    q_medium = sum(1 for q in quality_scores if 33 <= q < 67)
    q_low = sum(1 for q in quality_scores if q < 33)
    avg_quality = round(sum(quality_scores) / n) if n else 0
    verify_pct = round(sum(1 for s in filtered if s.get("has_verification")) / n * 100) if n else 0
    auto_pct = round(sum(1 for s in filtered if s.get("has_auto_mode")) / n * 100) if n else 0
    plan_pct = round(sum(1 for s in filtered if s.get("has_plan_mode")) / n * 100) if n else 0

    proj_quality_map: dict[str, list[int]] = defaultdict(list)
    for s in filtered:
        proj_quality_map[s.get("project", "unknown")].append(s.get("quality_score", 0))
    quality_by_project = sorted(
        [
            {"project": p, "avg_score": round(sum(v) / len(v)), "sessions": len(v)}
            for p, v in proj_quality_map.items()
        ],
        key=lambda x: x["avg_score"],
        reverse=True,
    )[:8]

    session_quality = {
        "avg_score": avg_quality,
        "distribution": {"high": q_high, "medium": q_medium, "low": q_low},
        "signals": {"verification_pct": verify_pct, "auto_pct": auto_pct, "plan_pct": plan_pct},
        "by_project": quality_by_project,
    }

    return {
        "overview": overview,
        "tokens": tokens,
        "activity": activity,
        "tools": tools,
        "models": models_list,
        "projects": projects_list,
        "feature_usage": feature_usage,
        "session_quality": session_quality,
        "insights": generate_insights(filtered),
        "days": days,
        "session_count": len(filtered),
    }
