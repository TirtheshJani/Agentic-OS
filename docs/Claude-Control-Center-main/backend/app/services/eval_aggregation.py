"""Eval aggregation — roll graded session results into dashboard stats.

Pure over a list of result dicts; ``now`` is injectable for deterministic
day-window filtering under test.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone


def empty_stats() -> dict:
    return {
        "total": 0, "graded": 0, "avg_score": 0,
        "grade_distribution": {}, "by_tool": {}, "trend": [],
        "flagged": [], "period_days": None,
    }


def build_stats(results: list[dict], days: int | None = 30, *, now: datetime | None = None) -> dict:
    if days:
        now = now or datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)
        filtered = []
        for r in results:
            ts = r.get("last_ts") or r.get("first_ts") or r.get("graded_at", "")
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if dt >= cutoff:
                    filtered.append(r)
            except Exception:
                continue
        results = filtered

    if not results:
        return empty_stats()

    done = [r for r in results if r.get("status") == "done"]
    scores = [r["composite_score"] for r in done if "composite_score" in r]

    grade_dist: dict[str, int] = defaultdict(int)
    for r in done:
        grade_dist[r.get("grade", "F")] += 1

    by_tool: dict[str, list[float]] = defaultdict(list)
    by_date: dict[str, list[float]] = defaultdict(list)
    for r in done:
        if "composite_score" in r:
            by_tool[r.get("tool", "unknown")].append(r["composite_score"])
            ts = r.get("graded_at", "")
            try:
                date = datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                by_date[date].append(r["composite_score"])
            except Exception:
                pass

    trend = [
        {"date": d, "avg_score": round(sum(v) / len(v), 1), "count": len(v)}
        for d, v in sorted(by_date.items())
    ]

    return {
        "total": len(results),
        "graded": len(done),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "grade_distribution": dict(grade_dist),
        "by_tool": {
            t: {"avg_score": round(sum(v) / len(v), 1), "count": len(v)}
            for t, v in by_tool.items()
        },
        "trend": trend,
        "flagged": [r for r in done if r.get("grade") in ("D", "F")],
        "period_days": days,
    }
