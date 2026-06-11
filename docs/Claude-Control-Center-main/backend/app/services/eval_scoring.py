"""Pure scoring functions for the eval orchestrator.

Each dimension scorer takes a plain dict and returns ``(score, details)`` with
no I/O — making the grading maths unit-testable in isolation.
"""
from __future__ import annotations


def letter_grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def score_token_efficiency(summary: dict) -> tuple[float, dict]:
    """Score 0-100 from cache hit rate, output density, and tool efficiency."""
    inp = summary.get("input_tokens", 0) or 1
    out = summary.get("output_tokens", 0) or 0
    cache_read = summary.get("cache_read_tokens", 0) or 0
    total_tokens = inp + cache_read

    cache_rate = cache_read / total_tokens if total_tokens > 0 else 0.0
    output_density = min(out / inp, 1.5) / 1.5  # normalize 0..1

    msg_count = summary.get("message_count", 1) or 1
    tool_count = sum(summary.get("tool_calls", {}).values()) or 1
    tool_per_msg = min(tool_count / msg_count, 5) / 5  # more tools per msg = efficient

    score = (
        cache_rate * 30
        + output_density * 40
        + tool_per_msg * 30
    ) * 100
    score = max(0.0, min(100.0, score))

    details = {
        "cache_hit_rate": round(cache_rate, 3),
        "output_density": round(output_density, 3),
        "tool_per_msg": round(tool_per_msg, 3),
        "input_tokens": inp,
        "output_tokens": out,
        "cache_read_tokens": cache_read,
    }
    return round(score, 1), details


def score_coherence(summary: dict) -> tuple[float, dict]:
    """Score 0-100 from plan mode, verification, auto mode, and tool focus."""
    score = 50.0  # neutral start

    if summary.get("has_plan_mode"):
        score += 15
    if summary.get("has_verification"):
        score += 20
    if summary.get("has_auto_mode"):
        score += 10

    advisor_calls = summary.get("advisor_call_count", 0) or 0
    if advisor_calls > 3:
        score -= min((advisor_calls - 3) * 3, 15)

    tool_names = list(summary.get("tool_calls", {}).keys())
    mcp_count = sum(1 for t in tool_names if t.startswith("mcp__"))
    if mcp_count > 10:
        score -= min((mcp_count - 10) * 2, 10)

    score = max(0.0, min(100.0, score))
    details = {
        "has_plan_mode": bool(summary.get("has_plan_mode")),
        "has_verification": bool(summary.get("has_verification")),
        "has_auto_mode": bool(summary.get("has_auto_mode")),
        "advisor_calls": advisor_calls,
        "distinct_tools": len(tool_names),
        "mcp_tools": mcp_count,
    }
    return round(score, 1), details


def score_code_quality_from_git(git_info: dict, static_info: dict) -> tuple[float, dict]:
    """Score 0-100 from git diff stats + static analysis. 50 if no git info."""
    if not git_info or git_info.get("commit_count", 0) == 0:
        return 50.0, {"reason": "no_commits"}

    score = 70.0  # baseline if commits exist

    files_changed = git_info.get("files_changed", 0)
    insertions = git_info.get("insertions", 0)
    deletions = git_info.get("deletions", 0)
    commits = git_info.get("commit_count", 0)

    score += min(commits * 2, 10)

    change_ratio = (insertions + deletions) / max(files_changed, 1)
    if change_ratio < 5 and files_changed > 5:
        score -= 10  # many files, tiny changes each — possible churn

    ts_errors = static_info.get("ts_errors")
    if ts_errors is not None:
        if ts_errors == 0:
            score += 10
        elif ts_errors <= 3:
            score += 5
        else:
            score -= min(ts_errors * 2, 15)

    pylint_errors = static_info.get("pylint_errors")
    if pylint_errors is not None:
        if pylint_errors == 0:
            score += 10
        elif pylint_errors <= 5:
            score += 3
        else:
            score -= min(pylint_errors, 10)

    score = max(0.0, min(100.0, score))
    details = {
        "files_changed": files_changed,
        "insertions": insertions,
        "deletions": deletions,
        "commits": commits,
        "ts_errors": ts_errors,
        "pylint_errors": pylint_errors,
    }
    return round(score, 1), details


def blend_code_quality(git_score: float, judge: dict) -> tuple[float, dict]:
    """Blend git/static score (50%) with LLM judge code_elegance (50%)."""
    elegance_score = (judge.get("code_elegance") or {}).get("score", 50)
    blended = (git_score * 0.5) + (elegance_score * 0.5)
    return round(blended, 1), {"git_score": git_score, "elegance_score": elegance_score}
