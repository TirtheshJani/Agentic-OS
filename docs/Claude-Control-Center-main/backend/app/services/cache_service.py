"""
Cache health service.

Derives cache hit-rate metrics from existing session summaries in
analytics_stats.json. No new file scanning — all data is already
parsed by analytics_service.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone, timedelta

from app.services import analytics_service


def _compute_hit_rate(inp: int, cr: int, cc: int) -> float:
    denom = inp + cr + cc
    return round(cr / denom * 100, 1) if denom > 0 else 0.0


def _cache_window_status(last_ts: str | None) -> tuple[str, float | None]:
    if not last_ts:
        return "unknown", None
    try:
        dt = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
        minutes = (datetime.now(timezone.utc) - dt).total_seconds() / 60
        if minutes < 50:
            status = "warm"
        elif minutes < 60:
            status = "expiring"
        else:
            status = "expired"
        return status, round(minutes, 1)
    except Exception:
        return "unknown", None


def _filter_by_days(summaries: list[dict], days: int | None) -> list[dict]:
    if not days:
        return summaries
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
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


def build_cache_stats(days: int | None = 30) -> dict:
    summaries = analytics_service.load()
    sessions = _filter_by_days(summaries, days)

    # --- Global aggregation ---
    total_inp = total_cr = total_cc = 0
    total_savings = 0.0

    for s in sessions:
        total_inp += s.get("input_tokens", 0)
        total_cr += s.get("cache_read_tokens", 0)
        total_cc += s.get("cache_creation_tokens", 0)
        total_savings += s.get("cache_savings_usd", 0.0)

    global_hit_rate = _compute_hit_rate(total_inp, total_cr, total_cc)

    # --- Daily hit rate time-series ---
    daily: dict[str, dict] = defaultdict(lambda: {"inp": 0, "cr": 0, "cc": 0})
    for s in sessions:
        ts = s.get("last_ts") or s.get("first_ts")
        if not ts:
            continue
        try:
            date = ts[:10]
            daily[date]["inp"] += s.get("input_tokens", 0)
            daily[date]["cr"] += s.get("cache_read_tokens", 0)
            daily[date]["cc"] += s.get("cache_creation_tokens", 0)
        except Exception:
            continue

    hit_rate_by_day = []
    for date in sorted(daily):
        d = daily[date]
        if d["inp"] + d["cr"] + d["cc"] == 0:
            continue
        hit_rate_by_day.append({
            "date": date,
            "hit_rate": _compute_hit_rate(d["inp"], d["cr"], d["cc"]),
            "cache_read": d["cr"],
            "cache_creation": d["cc"],
        })

    # --- Per-project aggregation ---
    project_data: dict[str, dict] = defaultdict(lambda: {
        "inp": 0, "cr": 0, "cc": 0, "savings": 0.0,
        "session_count": 0, "last_ts": None,
    })
    for s in sessions:
        proj = s.get("project") or s.get("project_dir") or "Unknown"
        pd = project_data[proj]
        pd["inp"] += s.get("input_tokens", 0)
        pd["cr"] += s.get("cache_read_tokens", 0)
        pd["cc"] += s.get("cache_creation_tokens", 0)
        pd["savings"] += s.get("cache_savings_usd", 0.0)
        pd["session_count"] += 1
        ts = s.get("last_ts") or s.get("first_ts")
        if ts and (pd["last_ts"] is None or ts > pd["last_ts"]):
            pd["last_ts"] = ts

    by_project = []
    for proj, pd in project_data.items():
        hr = _compute_hit_rate(pd["inp"], pd["cr"], pd["cc"])
        status, minutes_since = _cache_window_status(pd["last_ts"])
        by_project.append({
            "project": proj,
            "hit_rate": hr,
            "cache_read_tokens": pd["cr"],
            "cache_creation_tokens": pd["cc"],
            "input_tokens": pd["inp"],
            "savings_usd": round(pd["savings"], 6),
            "session_count": pd["session_count"],
            "last_session_end": pd["last_ts"],
            "minutes_since_last_session": minutes_since,
            "cache_window_status": status,
        })
    by_project.sort(key=lambda x: x["hit_rate"], reverse=True)

    # --- CLAUDE.md effectiveness signals ---
    claudemd: list[dict] = []
    for row in by_project:
        sc = row["session_count"]
        if sc == 0:
            continue
        avg_creation = round(row["cache_creation_tokens"] / sc)
        avg_read = round(row["cache_read_tokens"] / sc)
        effective = avg_creation > 5000 and row["hit_rate"] > 40.0
        claudemd.append({
            "project": row["project"],
            "avg_creation_per_session": avg_creation,
            "avg_read_per_session": avg_read,
            "hit_rate": row["hit_rate"],
            "effective": effective,
        })
    claudemd.sort(key=lambda x: x["avg_creation_per_session"], reverse=True)

    return {
        "global_hit_rate": global_hit_rate,
        "total_cache_read_tokens": total_cr,
        "total_cache_creation_tokens": total_cc,
        "total_savings_usd": round(total_savings, 4),
        "session_count": len(sessions),
        "days": days,
        "hit_rate_by_day": hit_rate_by_day,
        "by_project": by_project,
        "claudemd_effectiveness": claudemd,
    }


def get_session_cache_stats(project_dir: str, session_id: str) -> dict | None:
    summaries = analytics_service.load()
    for s in summaries:
        if s.get("project_dir") == project_dir and s.get("session_id") == session_id:
            inp = s.get("input_tokens", 0)
            cr = s.get("cache_read_tokens", 0)
            cc = s.get("cache_creation_tokens", 0)
            return {
                "hit_rate": _compute_hit_rate(inp, cr, cc),
                "cache_read_tokens": cr,
                "cache_creation_tokens": cc,
                "input_tokens": inp,
                "savings_usd": round(s.get("cache_savings_usd", 0.0), 6),
            }
    return None
