"""
Codeburn service — token cost estimation and task categorization.

Ports key logic from https://github.com/AgentSeal/codeburn into Python:
  - Model pricing table (hardcoded from codeburn's models.ts fallbacks)
  - Session classification into task categories (adapted from classifier.ts)
  - Exchange rate fetching (USD → CAD via Frankfurter API, 24h cache)
  - Codeburn stats aggregation for the /api/codeburn/stats endpoint
"""
from __future__ import annotations

import re
import threading
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx
import orjson

# ---------------------------------------------------------------------------
# Pricing table — USD per 1M tokens.
#
# Claude rows are sourced from codeburn models.ts fallbacks. OpenAI and Gemini
# rows cover the text-token models exposed through the local Model A/B Bench so
# cross-provider comparisons do not collapse to $0 for configured providers.
# ---------------------------------------------------------------------------

_MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4":      {"input": 15.00, "output": 75.00, "cache_read": 1.50,  "cache_write": 18.75},
    "claude-sonnet-4":    {"input":  3.00, "output": 15.00, "cache_read": 0.30,  "cache_write":  3.75},
    "claude-haiku-4":     {"input":  0.80, "output":  4.00, "cache_read": 0.08,  "cache_write":  1.00},
    "claude-3-5-sonnet":  {"input":  3.00, "output": 15.00, "cache_read": 0.30,  "cache_write":  3.75},
    "claude-3-5-haiku":   {"input":  0.80, "output":  4.00, "cache_read": 0.08,  "cache_write":  1.00},
    "claude-3-opus":      {"input": 15.00, "output": 75.00, "cache_read": 1.50,  "cache_write": 18.75},
    "claude-3-sonnet":    {"input":  3.00, "output": 15.00, "cache_read": 0.30,  "cache_write":  3.75},
    "claude-3-haiku":     {"input":  0.25, "output":  1.25, "cache_read": 0.03,  "cache_write":  0.30},

    # OpenAI standard text-token pricing. The bench path does not receive
    # cached-input counters, so cache_write remains zero for these providers.
    "gpt-5.5-pro":        {"input": 30.00, "output": 180.00, "cache_read": 0.00,  "cache_write": 0.00},
    "gpt-5.5":            {"input":  5.00, "output":  30.00, "cache_read": 0.50,  "cache_write": 0.00},
    "gpt-5.4-pro":        {"input": 30.00, "output": 180.00, "cache_read": 0.00,  "cache_write": 0.00},
    "gpt-5.4-mini":       {"input":  0.75, "output":   4.50, "cache_read": 0.075, "cache_write": 0.00},
    "gpt-5.4-nano":       {"input":  0.20, "output":   1.25, "cache_read": 0.02,  "cache_write": 0.00},
    "gpt-5.4":            {"input":  2.50, "output":  15.00, "cache_read": 0.25,  "cache_write": 0.00},
    "gpt-5.3-codex":      {"input":  1.75, "output":  14.00, "cache_read": 0.175, "cache_write": 0.00},
    "gpt-5.2-pro":        {"input": 21.00, "output": 168.00, "cache_read": 0.00,  "cache_write": 0.00},
    "gpt-5.2-codex":      {"input":  1.75, "output":  14.00, "cache_read": 0.175, "cache_write": 0.00},
    "gpt-5.2":            {"input":  1.75, "output":  14.00, "cache_read": 0.175, "cache_write": 0.00},
    "gpt-5.1-codex-mini": {"input":  0.25, "output":   2.00, "cache_read": 0.025, "cache_write": 0.00},
    "gpt-5.1-codex-max":  {"input":  1.25, "output":  10.00, "cache_read": 0.125, "cache_write": 0.00},
    "gpt-5.1-codex":      {"input":  1.25, "output":  10.00, "cache_read": 0.125, "cache_write": 0.00},
    "gpt-5.1":            {"input":  1.25, "output":  10.00, "cache_read": 0.125, "cache_write": 0.00},
    "gpt-5-pro":          {"input": 15.00, "output": 120.00, "cache_read": 0.00,  "cache_write": 0.00},
    "gpt-5-mini":         {"input":  0.25, "output":   2.00, "cache_read": 0.025, "cache_write": 0.00},
    "gpt-5-nano":         {"input":  0.05, "output":   0.40, "cache_read": 0.005, "cache_write": 0.00},
    "gpt-5":              {"input":  1.25, "output":  10.00, "cache_read": 0.125, "cache_write": 0.00},
    "gpt-4.1-mini":       {"input":  0.40, "output":   1.60, "cache_read": 0.10,  "cache_write": 0.00},
    "gpt-4.1-nano":       {"input":  0.10, "output":   0.40, "cache_read": 0.025, "cache_write": 0.00},
    "gpt-4.1":            {"input":  2.00, "output":   8.00, "cache_read": 0.50,  "cache_write": 0.00},
    "gpt-4o-mini":        {"input":  0.15, "output":   0.60, "cache_read": 0.075, "cache_write": 0.00},
    "gpt-4o-2024-05-13":  {"input":  5.00, "output":  15.00, "cache_read": 0.00,  "cache_write": 0.00},
    "gpt-4o":             {"input":  2.50, "output":  10.00, "cache_read": 1.25,  "cache_write": 0.00},
    "gpt-4":              {"input": 30.00, "output":  60.00, "cache_read": 0.00,  "cache_write": 0.00},
    "chatgpt-image-latest": {"input": 5.00, "output": 10.00, "cache_read": 1.25,  "cache_write": 0.00},
    "chatgpt":            {"input":  5.00, "output":  30.00, "cache_read": 0.50,  "cache_write": 0.00},
    "codex-mini-latest":  {"input":  1.50, "output":   6.00, "cache_read": 0.375, "cache_write": 0.00},
    "o4-mini-deep-research": {"input": 2.00, "output": 8.00, "cache_read": 0.50, "cache_write": 0.00},
    "o4-mini":            {"input":  1.10, "output":   4.40, "cache_read": 0.275, "cache_write": 0.00},
    "o3-deep-research":   {"input": 10.00, "output":  40.00, "cache_read": 2.50,  "cache_write": 0.00},
    "o3-pro":             {"input": 20.00, "output":  80.00, "cache_read": 0.00,  "cache_write": 0.00},
    "o3-mini":            {"input":  1.10, "output":   4.40, "cache_read": 0.55,  "cache_write": 0.00},
    "o3":                 {"input":  2.00, "output":   8.00, "cache_read": 0.50,  "cache_write": 0.00},
    "o1-pro":             {"input": 150.0, "output": 600.00, "cache_read": 0.00,  "cache_write": 0.00},
    "o1-mini":            {"input":  1.10, "output":   4.40, "cache_read": 0.55,  "cache_write": 0.00},
    "o1":                 {"input": 15.00, "output":  60.00, "cache_read": 7.50,  "cache_write": 0.00},

    # Gemini Developer API standard text-token pricing. Pro uses the <=200k
    # prompt tier because the bench sends a single short prompt.
    "gemini-3-pro-preview": {"input": 2.00, "output": 12.00, "cache_read": 0.20, "cache_write": 0.00},
    "gemini-3-flash-preview": {"input": 0.50, "output": 3.00, "cache_read": 0.05, "cache_write": 0.00},
    "gemini-2.5-flash-lite-preview": {"input": 0.05, "output": 0.20, "cache_read": 0.01,  "cache_write": 0.00},
    "gemini-2.5-flash-lite": {"input": 0.10, "output": 0.40, "cache_read": 0.01,  "cache_write": 0.00},
    "gemini-2.5-flash-image": {"input": 0.30, "output": 2.50, "cache_read": 0.03,  "cache_write": 0.00},
    "gemini-2.5-flash": {"input": 0.30, "output": 2.50, "cache_read": 0.03,  "cache_write": 0.00},
    "gemini-2.5-pro":   {"input": 1.25, "output": 10.00, "cache_read": 0.125, "cache_write": 0.00},
    "gemini-2.0-flash-lite": {"input": 0.075, "output": 0.30, "cache_read": 0.01875, "cache_write": 0.00},
    "gemini-2.0-flash": {"input": 0.10, "output": 0.40, "cache_read": 0.025, "cache_write": 0.00},
}

# Human-readable labels for each task category (matches codeburn's CATEGORY_LABELS)
CATEGORY_LABELS: dict[str, str] = {
    "coding":        "Coding",
    "debugging":     "Debugging",
    "refactoring":   "Refactoring",
    "feature":       "Feature Dev",
    "testing":       "Testing",
    "git":           "Git",
    "build_deploy":  "Build / Deploy",
    "exploration":   "Exploration",
    "planning":      "Planning",
    "delegation":    "Delegation",
    "brainstorming": "Brainstorming",
    "conversation":  "Conversation",
    "general":       "General",
}

# Tool sets used for session classification
_EDIT_TOOLS  = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
_AGENT_TOOLS = {"Agent"}
_READ_TOOLS  = {"Read", "Grep", "Glob", "WebFetch", "WebSearch"}

# Keyword sets for sub-category classification (applied when edit tools are present)
_KEYWORDS_DEBUGGING    = re.compile(r"\b(fix|bug|error|crash|exception|traceback|broken|failing|fail|issue|problem|not working)\b", re.I)
_KEYWORDS_REFACTORING  = re.compile(r"\b(refactor|rename|restructure|reorganize|clean up|cleanup|extract|move|split)\b", re.I)
_KEYWORDS_FEATURE      = re.compile(r"\b(add|create|implement|new feature|build|integrate|introduce)\b", re.I)
_KEYWORDS_TESTING      = re.compile(r"\b(test|pytest|jest|vitest|unittest|spec|coverage|assert)\b", re.I)
_KEYWORDS_GIT          = re.compile(r"\b(git (commit|push|pull|merge|rebase|branch|stash|checkout)|pr|pull request)\b", re.I)
_KEYWORDS_BUILD_DEPLOY = re.compile(r"\b(docker|deploy|build|ci|cd|pipeline|release|package|publish)\b", re.I)
_KEYWORDS_BRAINSTORM   = re.compile(r"\b(idea|strategy|what if|how (should|could|would)|brainstorm|plan|approach|design)\b", re.I)

# ---------------------------------------------------------------------------
# Pricing helpers
# ---------------------------------------------------------------------------

_DATE_SUFFIX_RE = re.compile(r"-\d{8}$")


def _normalize_model(model: str) -> str:
    """Lowercase and strip 8-digit date suffixes (e.g. -20250201)."""
    return _DATE_SUFFIX_RE.sub("", model.lower())


def _get_pricing(model: str) -> dict[str, float]:
    """Return the pricing dict for a model, using longest-prefix fuzzy matching."""
    normalized = _normalize_model(model)
    if normalized in _MODEL_PRICING:
        return _MODEL_PRICING[normalized]
    for key in sorted(_MODEL_PRICING, key=len, reverse=True):
        if normalized.startswith(key) or key in normalized:
            return _MODEL_PRICING[key]
    return {"input": 0.0, "output": 0.0, "cache_read": 0.0, "cache_write": 0.0}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> float:
    """Return estimated USD cost for one API call."""
    p = _get_pricing(model)
    M = 1_000_000
    return (
        input_tokens      * p["input"]       / M
        + output_tokens   * p["output"]      / M
        + cache_read_tokens  * p["cache_read"]  / M
        + cache_write_tokens * p["cache_write"] / M
    )


def calculate_cache_savings(model: str, cache_read_tokens: int) -> float:
    """Return USD saved by reading from cache vs paying full input price."""
    if cache_read_tokens <= 0:
        return 0.0
    p = _get_pricing(model)
    M = 1_000_000
    full_cost  = cache_read_tokens * p["input"]      / M
    cache_cost = cache_read_tokens * p["cache_read"] / M
    return max(0.0, full_cost - cache_cost)


# ---------------------------------------------------------------------------
# Session classification (adapted from codeburn classifier.ts)
# ---------------------------------------------------------------------------

def classify_session(session_summary: dict, user_text: str = "") -> str:
    """
    Classify a session into one of 13 codeburn task categories.

    Uses tool_calls dict and feature flags from the summary. When user_text is
    provided (concatenated user messages from the session), keyword matching
    further refines coding → debugging/refactoring/feature, bash → testing/git/build_deploy,
    and no-tools → brainstorming/conversation.
    """
    tool_calls: dict[str, int] = session_summary.get("tool_calls", {})

    if not tool_calls:
        if user_text and _KEYWORDS_BRAINSTORM.search(user_text):
            return "brainstorming"
        return "conversation"

    if session_summary.get("has_plan_mode") or "EnterPlanMode" in tool_calls:
        return "planning"

    if any(t in tool_calls for t in _AGENT_TOOLS):
        return "delegation"

    has_edits = any(t in tool_calls for t in _EDIT_TOOLS)
    has_bash  = "Bash" in tool_calls

    if has_edits:
        if user_text:
            if _KEYWORDS_TESTING.search(user_text):
                return "testing"
            if _KEYWORDS_DEBUGGING.search(user_text):
                return "debugging"
            if _KEYWORDS_REFACTORING.search(user_text):
                return "refactoring"
            if _KEYWORDS_FEATURE.search(user_text):
                return "feature"
        return "coding"

    if has_bash:
        if user_text:
            if _KEYWORDS_TESTING.search(user_text):
                return "testing"
            if _KEYWORDS_GIT.search(user_text):
                return "git"
            if _KEYWORDS_BUILD_DEPLOY.search(user_text):
                return "build_deploy"
        return "general"

    if tool_calls and all(t in _READ_TOOLS for t in tool_calls):
        return "exploration"

    return "general"


# ---------------------------------------------------------------------------
# Exchange rate — USD → CAD (or any ISO 4217 currency), 24h cache
# ---------------------------------------------------------------------------

_EXCHANGE_CACHE_FILE = Path(__file__).parent.parent.parent / "data" / "exchange_rate.json"
_exchange_lock = threading.Lock()


def get_exchange_rate(target_currency: str = "CAD") -> float:
    """
    Return the USD → target_currency exchange rate.
    Caches the response in backend/data/exchange_rate.json for 24 hours.
    Returns 1.0 on any error (no conversion).
    """
    with _exchange_lock:
        if _EXCHANGE_CACHE_FILE.exists():
            try:
                cached = orjson.loads(_EXCHANGE_CACHE_FILE.read_bytes())
                fetched_at = datetime.fromisoformat(
                    cached.get("fetched_at", "2000-01-01T00:00:00+00:00")
                )
                age = datetime.now(timezone.utc) - fetched_at
                if age < timedelta(hours=24):
                    rate = cached.get("rates", {}).get(target_currency)
                    if rate:
                        return float(rate)
            except Exception:
                pass

        try:
            resp = httpx.get(
                f"https://api.frankfurter.app/latest?from=USD&to={target_currency}",
                timeout=5.0,
            )
            data = resp.json()
            rate = data["rates"][target_currency]
            _EXCHANGE_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            _EXCHANGE_CACHE_FILE.write_bytes(
                orjson.dumps({
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                    "base": "USD",
                    "rates": data["rates"],
                })
            )
            return float(rate)
        except Exception:
            return 1.0


# ---------------------------------------------------------------------------
# Stats aggregation
# ---------------------------------------------------------------------------

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


def _generate_cost_insights(sessions: list[dict], exchange_rate: float) -> list[dict]:
    insights: list[dict] = []

    # Most expensive task category
    cat_costs: dict[str, float] = defaultdict(float)
    for s in sessions:
        cat_costs[s.get("task_category", "general")] += s.get("cost_usd", 0.0)

    if cat_costs:
        top_cat = max(cat_costs, key=lambda k: cat_costs[k])
        top_usd = cat_costs[top_cat]
        if top_usd > 0.01:
            label = CATEGORY_LABELS.get(top_cat, top_cat)
            insights.append({
                "type": "cost_top_category",
                "title": f"Most expensive: {label}",
                "description": (
                    f"{label} sessions account for ~CA${top_usd * exchange_rate:.2f} "
                    f"this period"
                ),
                "severity": "info",
                "data": {"category": top_cat, "cost_usd": top_usd},
            })

    # Unplanned sessions cost
    unplanned = [s for s in sessions if not s.get("has_plan_mode")]
    unplanned_cost = sum(s.get("cost_usd", 0.0) for s in unplanned)
    if unplanned_cost > 0.50 and unplanned:
        n = len(unplanned)
        insights.append({
            "type": "cost_unplanned_sessions",
            "title": "Unplanned sessions cost",
            "description": (
                f"{n} session{'s' if n != 1 else ''} without plan mode "
                f"cost ~CA${unplanned_cost * exchange_rate:.2f} "
                f"\u2014 try /plan first for complex tasks"
            ),
            "severity": "warning" if unplanned_cost > 2.0 else "info",
            "data": {"sessions": n, "cost_usd": unplanned_cost},
        })

    # Cache savings
    total_cache_savings = sum(s.get("cache_savings_usd", 0.0) for s in sessions)
    total_cache_read = sum(s.get("cache_read_tokens", 0) for s in sessions)
    if total_cache_savings > 0.01:
        insights.append({
            "type": "cost_cache_savings",
            "title": "Cache reduced your costs",
            "description": (
                f"Prompt cache saved you ~CA${total_cache_savings * exchange_rate:.2f} "
                f"by reusing {total_cache_read // 1_000:,}K tokens"
            ),
            "severity": "info",
            "data": {"tokens_saved": total_cache_read, "cost_saved_usd": total_cache_savings},
        })

    return insights


def build_codeburn_stats(summaries: list[dict], days: int | None = 30) -> dict:
    """Compute codeburn-style cost and category aggregations from session summaries."""
    filtered = _filter_by_days(summaries, days)
    exchange_rate = get_exchange_rate("CAD")

    empty = {
        "total_cost_usd": 0.0,
        "cost_by_day": [],
        "cost_by_model": [],
        "cost_by_project": [],
        "task_categories": [],
        "cache_efficiency": {"cache_hit_pct": 0.0, "tokens_saved": 0, "cost_saved_usd": 0.0},
        "cost_insights": [],
        "exchange_rate": exchange_rate,
        "display_currency": "CAD",
        "days": days,
        "session_count": 0,
    }
    if not filtered:
        return empty

    total_cost_usd = sum(s.get("cost_usd", 0.0) for s in filtered)

    # Cost by day
    day_cost: dict[str, float] = defaultdict(float)
    for s in filtered:
        date = (s.get("last_ts") or "")[:10]
        if date:
            day_cost[date] += s.get("cost_usd", 0.0)
    cost_by_day = sorted(
        [{"date": k, "cost_usd": v} for k, v in day_cost.items()],
        key=lambda x: x["date"],
    )

    # Cost by model — proportional attribution by token share within each session
    model_cost_map: dict[str, dict] = defaultdict(lambda: {"cost_usd": 0.0, "sessions": 0})
    for s in filtered:
        models_in_session = s.get("models", {})
        session_cost = s.get("cost_usd", 0.0)
        if not models_in_session or session_cost == 0:
            continue
        total_session_tokens = sum(d.get("tokens", 0) for d in models_in_session.values())
        if total_session_tokens == 0:
            continue
        for model, data in models_in_session.items():
            frac = data.get("tokens", 0) / total_session_tokens
            model_cost_map[model]["cost_usd"] += session_cost * frac
            model_cost_map[model]["sessions"] += 1

    cost_by_model = sorted(
        [{"model": k, "cost_usd": v["cost_usd"], "sessions": v["sessions"]}
         for k, v in model_cost_map.items()],
        key=lambda x: x["cost_usd"],
        reverse=True,
    )

    # Cost by project
    proj_cost_map: dict[str, dict] = defaultdict(lambda: {"cost_usd": 0.0, "sessions": 0})
    for s in filtered:
        p = s.get("project", "unknown")
        proj_cost_map[p]["cost_usd"] += s.get("cost_usd", 0.0)
        proj_cost_map[p]["sessions"] += 1

    cost_by_project = sorted(
        [{"project": k, "cost_usd": v["cost_usd"], "sessions": v["sessions"]}
         for k, v in proj_cost_map.items()],
        key=lambda x: x["cost_usd"],
        reverse=True,
    )[:8]

    # Task category breakdown
    cat_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "cost_usd": 0.0})
    for s in filtered:
        cat = s.get("task_category", "general")
        cat_map[cat]["count"] += 1
        cat_map[cat]["cost_usd"] += s.get("cost_usd", 0.0)

    task_categories = sorted(
        [
            {
                "category": cat,
                "label": CATEGORY_LABELS.get(cat, cat),
                "count": v["count"],
                "cost_usd": v["cost_usd"],
            }
            for cat, v in cat_map.items()
        ],
        key=lambda x: x["cost_usd"],
        reverse=True,
    )

    # Cache efficiency
    total_input      = sum(s.get("input_tokens", 0)          for s in filtered)
    total_cache_read = sum(s.get("cache_read_tokens", 0)      for s in filtered)
    total_savings    = sum(s.get("cache_savings_usd", 0.0)    for s in filtered)
    billable_input   = total_input + total_cache_read
    cache_hit_pct    = round(
        (total_cache_read / billable_input * 100) if billable_input > 0 else 0.0, 1
    )

    return {
        "total_cost_usd":  total_cost_usd,
        "cost_by_day":     cost_by_day,
        "cost_by_model":   cost_by_model,
        "cost_by_project": cost_by_project,
        "task_categories": task_categories,
        "cache_efficiency": {
            "cache_hit_pct":    cache_hit_pct,
            "tokens_saved":     total_cache_read,
            "cost_saved_usd":   total_savings,
        },
        "cost_insights":   _generate_cost_insights(filtered, exchange_rate),
        "exchange_rate":   exchange_rate,
        "display_currency": "CAD",
        "days":            days,
        "session_count":   len(filtered),
    }
