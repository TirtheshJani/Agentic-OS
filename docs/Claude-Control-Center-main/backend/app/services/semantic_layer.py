"""
Semantic layer — a governed catalog of metrics and dimensions over the cached
session analytics, queried via plain-Python aggregation.

Adapted from Anthropic's self-service data-analytics architecture
(https://claude.com/blog/how-anthropic-enables-self-service-data-analytics-with-claude).
The article's "sources of truth" layer is a compiled set of metric/dimension
definitions that downstream agents must consult *first* instead of querying raw
data directly. This module is that layer for Claude Control Center:

  * **Metrics**   — governed measures (single source of truth) with a grain,
                    unit, aggregation rule and owner.
  * **Dimensions** — the legal ways to slice a metric.
  * **Query**     — resolve ``metric × dimension × window × filters`` against the
                    cached ``analytics_stats.json`` summaries, returning rows
                    plus a **provenance footer** (source, freshness, definition).

There is no database and no LLM here — the layer is intentionally declarative so
it can later be handed to an agent as the governed entry point to the data.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from app.services import analytics_service

# ---------------------------------------------------------------------------
# Measure extractors — one per metric, mapping a session summary to a number.
# Kept separate from the serialisable metadata below so the catalog endpoint
# stays pure JSON.
# ---------------------------------------------------------------------------

Summary = dict


def _tool_call_total(s: Summary) -> float:
    calls = s.get("tool_calls") or {}
    return float(sum(calls.values())) if isinstance(calls, dict) else 0.0


_MEASURE_EXTRACTORS: dict[str, Callable[[Summary], float]] = {
    "sessions":           lambda s: 1.0,
    "messages":           lambda s: float(s.get("message_count") or 0),
    "tokens_input":       lambda s: float(s.get("input_tokens") or 0),
    "tokens_output":      lambda s: float(s.get("output_tokens") or 0),
    "tokens_total":       lambda s: float((s.get("input_tokens") or 0) + (s.get("output_tokens") or 0)),
    "cache_read_tokens":  lambda s: float(s.get("cache_read_tokens") or 0),
    "cost_usd":           lambda s: float(s.get("cost_usd") or 0.0),
    "cache_savings_usd":  lambda s: float(s.get("cache_savings_usd") or 0.0),
    "tool_calls":         _tool_call_total,
    "advisor_calls":      lambda s: float(s.get("advisor_call_count") or 0),
    "quality_score":      lambda s: float(s.get("quality_score") or 0),
}

# ---------------------------------------------------------------------------
# Metric catalog — the governed source of truth. Order is presentation order.
# ---------------------------------------------------------------------------

METRICS: list[dict] = [
    {
        "key": "sessions", "label": "Sessions", "unit": "count",
        "aggregation": "count", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Count of Claude Code sessions (one JSONL transcript each).",
        "gotchas": "Empty transcripts are dropped at ingest, so this excludes zero-message sessions.",
    },
    {
        "key": "messages", "label": "Messages", "unit": "count",
        "aggregation": "sum", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Total user + assistant messages exchanged.",
        "gotchas": "Tool results and permission-mode markers are not counted as messages.",
    },
    {
        "key": "tokens_total", "label": "Total Tokens", "unit": "tokens",
        "aggregation": "sum", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Input + output tokens across all assistant turns.",
        "gotchas": "Excludes cache-read and cache-creation tokens — see the dedicated cache metric.",
    },
    {
        "key": "tokens_input", "label": "Input Tokens", "unit": "tokens",
        "aggregation": "sum", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Prompt (input) tokens billed across assistant turns.",
        "gotchas": "",
    },
    {
        "key": "tokens_output", "label": "Output Tokens", "unit": "tokens",
        "aggregation": "sum", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Completion (output) tokens generated across assistant turns.",
        "gotchas": "",
    },
    {
        "key": "cache_read_tokens", "label": "Cache-Read Tokens", "unit": "tokens",
        "aggregation": "sum", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Tokens served from the prompt cache instead of being re-billed at full rate.",
        "gotchas": "High cache-read volume is good — it is the source of the cache-savings metric.",
    },
    {
        "key": "cost_usd", "label": "Cost (USD)", "unit": "usd",
        "aggregation": "sum", "grain": "message", "owner": "codeburn",
        "source": "codeburn_service",
        "description": "Estimated spend, priced per message from the codeburn model-pricing table.",
        "gotchas": "An estimate from published list prices; rolled up to the session in the cache, "
                   "so message-grain queries are approximate.",
    },
    {
        "key": "cache_savings_usd", "label": "Cache Savings (USD)", "unit": "usd",
        "aggregation": "sum", "grain": "message", "owner": "codeburn",
        "source": "codeburn_service",
        "description": "Estimated dollars avoided by cache-reads vs. paying full input price.",
        "gotchas": "Counterfactual estimate, not a billed line item.",
    },
    {
        "key": "tool_calls", "label": "Tool Calls", "unit": "count",
        "aggregation": "sum", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Total tool invocations (Edit, Bash, Read, Agent, MCP tools, …).",
        "gotchas": "Sums every tool name; use the tool breakdown on the Analytics page for per-tool detail.",
    },
    {
        "key": "advisor_calls", "label": "Advisor Calls", "unit": "count",
        "aggregation": "sum", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Server-side advisor (server_tool_use) invocations.",
        "gotchas": "",
    },
    {
        "key": "quality_score", "label": "Avg Quality Score", "unit": "score",
        "aggregation": "avg", "grain": "session", "owner": "analytics",
        "source": "analytics_ingest",
        "description": "Mean session quality (0–100) from verification, auto-mode and plan-mode signals.",
        "gotchas": "A heuristic composite, not a measure of output correctness.",
    },
]

_METRICS_BY_KEY = {m["key"]: m for m in METRICS}

# ---------------------------------------------------------------------------
# Dimension catalog — the legal slices. ``extractor`` returns the bucket label.
# ---------------------------------------------------------------------------


def _primary_model(s: Summary) -> str:
    models = s.get("models") or {}
    if not isinstance(models, dict) or not models:
        return "unknown"
    return max(models.items(), key=lambda kv: (kv[1] or {}).get("messages", 0))[0]


def _day(s: Summary) -> str | None:
    ts = s.get("last_ts")
    return ts[:10] if isinstance(ts, str) and len(ts) >= 10 else None


def _week(s: Summary) -> str | None:
    ts = s.get("last_ts")
    if not isinstance(ts, str):
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _bool_label(field: str) -> Callable[[Summary], str]:
    return lambda s: "yes" if s.get(field) else "no"


DIMENSIONS: list[dict] = [
    {
        "key": "project", "label": "Project", "type": "categorical",
        "source": "project_decoder",
        "description": "Repository / working directory the session ran in.",
        "extractor": lambda s: s.get("project") or "unknown",
    },
    {
        "key": "task_category", "label": "Task Category", "type": "categorical",
        "source": "codeburn_service",
        "description": "Inferred work type (coding, debugging, refactoring, …).",
        "extractor": lambda s: s.get("task_category") or "general",
    },
    {
        "key": "model", "label": "Primary Model", "type": "categorical",
        "source": "analytics_ingest",
        "description": "The model handling the most messages in the session.",
        "extractor": _primary_model,
    },
    {
        "key": "permission_mode", "label": "Permission Mode", "type": "categorical",
        "source": "analytics_ingest",
        "description": "Initial permission mode (default, auto, plan, …).",
        "extractor": lambda s: s.get("permission_mode") or "default",
    },
    {
        "key": "day", "label": "Day", "type": "temporal",
        "source": "analytics_ingest",
        "description": "Calendar day of the session's last activity (UTC).",
        "extractor": _day,
    },
    {
        "key": "week", "label": "ISO Week", "type": "temporal",
        "source": "analytics_ingest",
        "description": "ISO week of the session's last activity (UTC).",
        "extractor": _week,
    },
    {
        "key": "has_plan_mode", "label": "Used Plan Mode", "type": "boolean",
        "source": "analytics_ingest",
        "description": "Whether the session entered plan mode.",
        "extractor": _bool_label("has_plan_mode"),
    },
    {
        "key": "has_verification", "label": "Verified Work", "type": "boolean",
        "source": "analytics_ingest",
        "description": "Whether the session ran tests/builds to verify its work.",
        "extractor": _bool_label("has_verification"),
    },
]

_DIMENSIONS_BY_KEY = {d["key"]: d for d in DIMENSIONS}

# Hygiene filters applied to every query, surfaced in the provenance footer.
HYGIENE = [
    "Zero-message sessions excluded at ingest.",
    "Sessions missing a timestamp are excluded from time-windowed and temporal-dimension queries.",
]


# ---------------------------------------------------------------------------
# Catalog (serialisable view)
# ---------------------------------------------------------------------------

def _serialisable_metric(m: dict) -> dict:
    return {k: v for k, v in m.items() if k != "extractor"}


def _serialisable_dimension(d: dict) -> dict:
    return {k: v for k, v in d.items() if k != "extractor"}


def catalog() -> dict:
    """Return the full governed catalog as JSON-safe metadata."""
    return {
        "metrics": [_serialisable_metric(m) for m in METRICS],
        "dimensions": [_serialisable_dimension(d) for d in DIMENSIONS],
        "hygiene": HYGIENE,
        "provenance": _provenance_base(),
    }


# ---------------------------------------------------------------------------
# Query engine
# ---------------------------------------------------------------------------

def _data_file() -> Path:
    return analytics_service.get_analytics_service()._data_file  # noqa: SLF001 (intentional source ref)


def _provenance_base() -> dict:
    f = _data_file()
    freshness_iso: str | None = None
    age_seconds: int | None = None
    if f.exists():
        mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
        freshness_iso = mtime.isoformat()
        age_seconds = int((datetime.now(timezone.utc) - mtime).total_seconds())
    return {
        "source": "analytics_stats.json",
        "source_path": str(f),
        "freshness": freshness_iso,
        "age_seconds": age_seconds,
        "scanner": "analytics",
    }


def _aggregate(values: list[float], aggregation: str) -> float:
    if aggregation == "count":
        return float(len(values))
    if not values:
        return 0.0
    if aggregation == "sum":
        return float(sum(values))
    if aggregation == "avg":
        return float(sum(values) / len(values))
    if aggregation == "max":
        return float(max(values))
    if aggregation == "min":
        return float(min(values))
    return float(sum(values))


def _within_window(s: Summary, cutoff: datetime | None) -> bool:
    if cutoff is None:
        return True
    ts = s.get("last_ts")
    if not isinstance(ts, str):
        return False
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return False
    return dt >= cutoff


def query(
    metric_key: str,
    *,
    group_by: str | None = None,
    days: int | None = 30,
    filters: dict[str, str] | None = None,
    limit: int | None = 50,
) -> dict:
    """Resolve a governed metric, optionally sliced by a dimension.

    Returns rows (one per dimension value, or a single ``total`` row) plus a
    provenance footer. Raises ``KeyError`` for unknown metric/dimension keys.
    """
    metric = _METRICS_BY_KEY.get(metric_key)
    if metric is None:
        raise KeyError(f"unknown metric: {metric_key}")

    dimension = None
    if group_by:
        dimension = _DIMENSIONS_BY_KEY.get(group_by)
        if dimension is None:
            raise KeyError(f"unknown dimension: {group_by}")

    extractor = _MEASURE_EXTRACTORS[metric_key]
    aggregation = metric["aggregation"]

    summaries = analytics_service.load()

    cutoff = None
    if days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # --- filter (hygiene window + dimension filters) -----------------------
    active_filters = {k: v for k, v in (filters or {}).items() if v not in (None, "")}
    rows_in: list[Summary] = []
    for s in summaries:
        if not _within_window(s, cutoff):
            continue
        ok = True
        for fk, fv in active_filters.items():
            fdim = _DIMENSIONS_BY_KEY.get(fk)
            if fdim is None:
                raise KeyError(f"unknown filter dimension: {fk}")
            if str(fdim["extractor"](s)) != str(fv):
                ok = False
                break
        if ok:
            rows_in.append(s)

    # --- group + aggregate -------------------------------------------------
    if dimension is None:
        value = _aggregate([extractor(s) for s in rows_in], aggregation)
        rows = [{"group": "total", "value": round(value, 6), "sessions": len(rows_in)}]
        total = value
    else:
        buckets: dict[str, list[float]] = {}
        for s in rows_in:
            label = dimension["extractor"](s)
            if label is None:  # temporal/missing — excluded per hygiene rule
                continue
            buckets.setdefault(str(label), []).append(extractor(s))
        rows = [
            {"group": label, "value": round(_aggregate(vals, aggregation), 6), "sessions": len(vals)}
            for label, vals in buckets.items()
        ]
        # Temporal dimensions sort chronologically; everything else by value desc.
        if dimension["type"] == "temporal":
            rows.sort(key=lambda r: r["group"])
        else:
            rows.sort(key=lambda r: r["value"], reverse=True)
        if limit is not None and dimension["type"] != "temporal":
            rows = rows[:limit]
        total = _aggregate([extractor(s) for s in rows_in], aggregation)

    provenance = _provenance_base()
    provenance.update({
        "grain": metric["grain"],
        "unit": metric["unit"],
        "aggregation": aggregation,
        "owner": metric["owner"],
        "definition": metric["description"],
        "gotchas": metric.get("gotchas") or "",
        "hygiene": HYGIENE,
        "window_days": days,
        "filters": active_filters,
    })

    return {
        "metric": _serialisable_metric(metric),
        "dimension": _serialisable_dimension(dimension) if dimension else None,
        "rows": rows,
        "total": round(total, 6),
        "session_count": len(rows_in),
        "provenance": provenance,
    }
