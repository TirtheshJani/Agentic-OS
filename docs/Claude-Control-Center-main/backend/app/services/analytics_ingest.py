"""Analytics ingest — scan session JSONL into per-session summaries.

Pure functions: callers pass in the directories to scan. No global state, no
caching (the owning :class:`AnalyticsService` handles persistence). This makes
the scan logic trivially unit-testable against a tmp tree.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import orjson

from app.services.analytics_cost import cache_savings, classify, message_cost
from app.services.project_decoder import decode_project_dir, display_name

# Matches test/build commands that indicate Claude verified its work (Boris tip #6)
_VERIFY_RE = re.compile(
    r'pytest|npm\s+(test|run\s+test|run\s+build)|tsc(\s|$)|eslint|ruff|mypy'
    r'|cargo\s+(test|build)|go\s+test|make\s+(test|build|check)'
    r'|jest|vitest|mocha',
    re.IGNORECASE,
)


def _iter_raw(path: Path):
    with open(path, "rb") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                yield orjson.loads(raw)
            except Exception:
                continue


def _get_content(msg: dict) -> list:
    """Return content blocks from a message, trying both known locations."""
    content = msg.get("content")
    if content is None:
        content = (msg.get("message") or {}).get("content")
    if isinstance(content, list):
        return content
    return []


def _has_ultraplan_command(content) -> bool:
    """Return True if any content block contains an /ultraplan command invocation."""
    if isinstance(content, str):
        return "<command-name>/ultraplan</command-name>" in content
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict):
                text = block.get("text", "")
                if isinstance(text, str) and "<command-name>/ultraplan</command-name>" in text:
                    return True
    return False


def scan_file(jsonl_path: Path, project_dirname: str) -> dict | None:
    """Scan a single JSONL file and return a session summary dict."""
    messages = list(_iter_raw(jsonl_path))
    if not messages:
        return None

    session_id = jsonl_path.stem
    project = display_name(project_dirname)
    project_path = decode_project_dir(project_dirname)

    first_ts: str | None = None
    last_ts: str | None = None
    message_count = 0
    input_tokens = 0
    output_tokens = 0
    cache_read_tokens = 0
    cache_creation_tokens = 0
    tool_calls: dict[str, int] = defaultdict(int)
    models: dict[str, dict] = defaultdict(lambda: {"messages": 0, "tokens": 0})
    hourly: dict[int, int] = defaultdict(int)
    daily: dict[str, dict] = defaultdict(lambda: {"input": 0, "output": 0, "messages": 0})
    has_plan_mode = False
    advisor_call_count = 0

    # Feature tracking
    permission_modes: list[str] = []
    computer_use_calls = 0
    has_ultraplan = False

    # Quality signals (Boris Cherny tip #6: give Claude a way to verify its work)
    has_verification = False
    verification_calls = 0

    # Cost tracking (via codeburn pricing)
    cost_usd = 0.0
    cache_savings_usd = 0.0

    # Collect user message text for keyword-based task classification
    user_text_parts: list[str] = []

    for msg in messages:
        msg_type = msg.get("type")

        # Capture permission-mode metadata entries (not user/assistant messages)
        if msg_type == "permission-mode":
            mode = msg.get("permissionMode")
            if mode and mode not in permission_modes:
                permission_modes.append(mode)
            continue

        if msg_type not in ("user", "assistant"):
            continue

        message_count += 1

        ts = msg.get("timestamp")
        if ts:
            if first_ts is None or ts < first_ts:
                first_ts = ts
            if last_ts is None or ts > last_ts:
                last_ts = ts

            # Bucket by hour and date
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                hourly[dt.hour] += 1
                date_key = dt.strftime("%Y-%m-%d")
                daily[date_key]["messages"] += 1
            except Exception:
                pass

        # Check user messages for ultraplan command and collect text for classification
        if msg_type == "user":
            raw_content = (msg.get("message") or {}).get("content") or msg.get("content")
            if not has_ultraplan and _has_ultraplan_command(raw_content):
                has_ultraplan = True
            # Collect plain text from user messages for keyword-based category detection
            if isinstance(raw_content, str):
                user_text_parts.append(raw_content[:500])
            elif isinstance(raw_content, list):
                for block in raw_content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text = block.get("text", "")
                        if text:
                            user_text_parts.append(text[:500])

        if msg_type != "assistant":
            continue

        # Token usage — usage and model are nested inside msg["message"] in Claude Code JSONL
        inner_msg = msg.get("message") or {}
        usage = inner_msg.get("usage") or msg.get("usage") or {}
        inp = usage.get("input_tokens", 0) or 0
        out = usage.get("output_tokens", 0) or 0
        cr = usage.get("cache_read_input_tokens", 0) or usage.get("cache_read_tokens", 0) or 0
        cc = usage.get("cache_creation_input_tokens", 0) or usage.get("cache_creation_tokens", 0) or 0
        input_tokens += inp
        output_tokens += out
        cache_read_tokens += cr
        cache_creation_tokens += cc

        # Bucket tokens by date
        if ts:
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                date_key = dt.strftime("%Y-%m-%d")
                daily[date_key]["input"] += inp
                daily[date_key]["output"] += out
            except Exception:
                pass

        # Model tracking — model is nested inside msg["message"]
        model = inner_msg.get("model") or msg.get("model")
        if model:
            models[model]["messages"] += 1
            models[model]["tokens"] += inp + out
            # Accumulate cost and cache savings per message
            cost_usd += message_cost(model, inp, out, cr, cc)
            cache_savings_usd += cache_savings(model, cr)

        # Content blocks
        for block in _get_content(msg):
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if block_type == "tool_use":
                name = block.get("name", "unknown")
                tool_calls[name] += 1
                if name in ("EnterPlanMode", "ExitPlanMode"):
                    has_plan_mode = True
                # Computer use detection: MCP tools from the computer-use server
                if name.startswith("mcp__computer-use__"):
                    computer_use_calls += 1
                # Verification detection: Bash commands that run tests/builds
                if name == "Bash":
                    cmd = block.get("input", {}).get("command", "")
                    if isinstance(cmd, str) and _VERIFY_RE.search(cmd):
                        verification_calls += 1
                        has_verification = True
            elif block_type == "server_tool_use":
                advisor_call_count += 1

    if message_count == 0:
        return None

    has_auto_mode = "auto" in permission_modes
    initial_permission_mode = permission_modes[0] if permission_modes else "default"

    quality_score = (
        (34 if has_verification else 0)
        + (33 if has_auto_mode else 0)
        + (33 if has_plan_mode else 0)
    )

    partial_summary = {
        "session_id": session_id,
        "project_dir": project_dirname,
        "project": project,
        "project_path": project_path,
        "first_ts": first_ts,
        "last_ts": last_ts,
        "message_count": message_count,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_read_tokens": cache_read_tokens,
        "cache_creation_tokens": cache_creation_tokens,
        "tool_calls": dict(tool_calls),
        "models": {k: dict(v) for k, v in models.items()},
        "hourly": {str(k): v for k, v in hourly.items()},
        "daily": [
            {"date": date, "input": vals["input"], "output": vals["output"], "messages": vals["messages"]}
            for date, vals in sorted(daily.items())
        ],
        "has_plan_mode": has_plan_mode,
        "advisor_call_count": advisor_call_count,
        # Feature fields
        "permission_mode": initial_permission_mode,
        "permission_modes": permission_modes,
        "has_auto_mode": has_auto_mode,
        "has_computer_use": computer_use_calls > 0,
        "computer_use_calls": computer_use_calls,
        "has_ultraplan": has_ultraplan,
        # Codeburn cost fields
        "cost_usd": round(cost_usd, 6),
        "cache_savings_usd": round(cache_savings_usd, 6),
        # Quality signals
        "has_verification": has_verification,
        "verification_calls": verification_calls,
        "quality_score": quality_score,
    }
    user_text = " ".join(user_text_parts)
    partial_summary["task_category"] = classify(partial_summary, user_text)
    return partial_summary


def scan_projects(projects_dir: Path) -> list[dict]:
    """Scan every session JSONL under ``projects_dir`` into summaries."""
    if not projects_dir.exists():
        return []
    summaries: list[dict] = []
    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        dirname = project_dir.name
        for jsonl_file in project_dir.glob("*.jsonl"):
            try:
                summary = scan_file(jsonl_file, dirname)
                if summary:
                    summaries.append(summary)
            except Exception:
                continue
    return summaries
