"""
LLM-as-judge for the eval system.

Calls claude-haiku-4-5 to grade a session on four rubric dimensions:
  - prompt_clarity     (were the user's prompts clear and specific?)
  - token_efficiency   (value delivered per token consumed?)
  - agent_accuracy     (did the agent do what was asked without hallucinating?)
  - code_elegance      (is the produced code clean, idiomatic, minimal?)

Each dimension is scored 0-100 with a one-sentence explanation.
Budget is shared with the EVAL_DAILY_BUDGET_USD env var (default $2 / day).
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.config import ANTHROPIC_API_KEY, ANTHROPIC_HAIKU_MODEL

# ---------------------------------------------------------------------------
# Budget tracking
# ---------------------------------------------------------------------------

_EVAL_DAILY_BUDGET_USD = float(os.getenv("EVAL_DAILY_BUDGET_USD", "2.00"))
_HAIKU_INPUT_USD_PER_MTOK = 1.00
_HAIKU_OUTPUT_USD_PER_MTOK = 5.00

_BUDGET_PATH = Path(__file__).parent.parent.parent / "data" / "eval_budget.json"
_budget_lock = threading.Lock()


def _load_budget() -> dict:
    try:
        data = orjson.loads(_BUDGET_PATH.read_bytes())
        if data.get("date") == datetime.now(timezone.utc).strftime("%Y-%m-%d"):
            return data
    except Exception:
        pass
    return {"date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "spent_usd": 0.0}


def _save_budget(data: dict) -> None:
    _BUDGET_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _BUDGET_PATH.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(data))
    tmp.replace(_BUDGET_PATH)


def _check_budget() -> None:
    with _budget_lock:
        data = _load_budget()
        if data["spent_usd"] >= _EVAL_DAILY_BUDGET_USD:
            raise RuntimeError(
                f"Eval daily budget exhausted (${data['spent_usd']:.4f} / ${_EVAL_DAILY_BUDGET_USD:.2f})"
            )


def _record_spend(input_tokens: int, output_tokens: int) -> None:
    with _budget_lock:
        data = _load_budget()
        cost = (
            input_tokens * _HAIKU_INPUT_USD_PER_MTOK / 1_000_000
            + output_tokens * _HAIKU_OUTPUT_USD_PER_MTOK / 1_000_000
        )
        data["spent_usd"] = round(data.get("spent_usd", 0.0) + cost, 6)
        _save_budget(data)


def get_budget_status() -> dict:
    with _budget_lock:
        data = _load_budget()
    return {
        "date": data["date"],
        "spent_usd": data["spent_usd"],
        "limit_usd": _EVAL_DAILY_BUDGET_USD,
        "remaining_usd": max(0.0, _EVAL_DAILY_BUDGET_USD - data["spent_usd"]),
        "exhausted": data["spent_usd"] >= _EVAL_DAILY_BUDGET_USD,
    }


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM = """You are an expert software engineering evaluator. Given a summary of a Claude Code or Codex CLI session, grade the session on four dimensions. Return ONLY valid JSON, no prose.

Rubric (each dimension 0–100):

prompt_clarity: How clear, specific, and well-formed were the user's prompts?
  - 90-100: Precise, contextual, one intent per prompt, provides constraints.
  - 70-89: Mostly clear; minor ambiguity that required clarification.
  - 50-69: Vague or multi-intent; agent had to guess.
  - 0-49: Confusing, contradictory, or extremely under-specified.

token_efficiency: How much value was delivered per token consumed?
  - 90-100: Tight prompts, cache hits used well, minimal re-explanation, lots accomplished.
  - 70-89: Mostly efficient; a few unnecessary back-and-forth exchanges.
  - 50-69: Moderate waste; repeated instructions, unnecessary verification loops.
  - 0-49: High token consumption with little result, or many correction cycles.

agent_accuracy: Did the agent correctly implement the stated intent without hallucinating?
  - 90-100: Followed instructions precisely, no off-task work, no hallucinated APIs.
  - 70-89: Mostly accurate; minor deviation corrected quickly.
  - 50-69: Several corrections needed; partial hallucinations.
  - 0-49: Went significantly off-track, introduced bugs, or invented non-existent APIs.

code_elegance: Is the code produced clean, idiomatic, minimal, and readable?
  - 90-100: Concise, well-named, no unnecessary abstraction, follows project conventions.
  - 70-89: Clean overall; some verbosity or minor style issues.
  - 50-69: Works but verbose, inconsistent, or over-engineered.
  - 0-49: Messy, fragile, or introduces technical debt.
  - N/A (score 50): No code was produced in this session.

Return exactly this JSON shape:
{
  "prompt_clarity": {"score": <int 0-100>, "reason": "<one sentence>"},
  "token_efficiency": {"score": <int 0-100>, "reason": "<one sentence>"},
  "agent_accuracy": {"score": <int 0-100>, "reason": "<one sentence>"},
  "code_elegance": {"score": <int 0-100>, "reason": "<one sentence>"}
}"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def judge_session(session_summary: dict, diff_text: str = "") -> dict:
    """
    Grade a session using claude-haiku-4-5 as judge.

    *session_summary* must have at minimum: session_id, tool, task_category,
    message_count, input_tokens, output_tokens, first_ts, last_ts,
    tool_calls (dict), and optionally first_user_msg / last_user_msg.

    *diff_text* is a truncated git diff (≤8 KB) or empty string.

    Returns the rubric dict on success, or a fallback dict with score=50 on
    any error (budget, no API key, network failure).
    """
    if not ANTHROPIC_API_KEY:
        return _fallback("no_api_key")

    try:
        _check_budget()
    except RuntimeError as exc:
        return _fallback("budget_exhausted", str(exc))

    # Build compact session context for the prompt
    tool_top = sorted(session_summary.get("tool_calls", {}).items(), key=lambda x: -x[1])[:10]
    ctx = {
        "tool": session_summary.get("tool", "unknown"),
        "task_category": session_summary.get("task_category", "general"),
        "message_count": session_summary.get("message_count", 0),
        "input_tokens": session_summary.get("input_tokens", 0),
        "output_tokens": session_summary.get("output_tokens", 0),
        "cache_read_tokens": session_summary.get("cache_read_tokens", 0),
        "duration_seconds": session_summary.get("duration_seconds"),
        "top_tools": [{"name": n, "count": c} for n, c in tool_top],
        "has_plan_mode": session_summary.get("has_plan_mode", False),
        "has_verification": session_summary.get("has_verification", False),
        "first_user_msg": session_summary.get("first_user_msg", "")[:400],
        "last_user_msg": session_summary.get("last_user_msg", "")[:400],
        "project": session_summary.get("project", ""),
    }

    diff_section = ""
    if diff_text:
        truncated = diff_text[:8000]
        diff_section = f"\n\n## Git Diff (truncated)\n```diff\n{truncated}\n```"

    user_msg = f"## Session Data\n```json\n{json.dumps(ctx, indent=2)}\n```{diff_section}"

    try:
        from anthropic import Anthropic  # local import — fail at runtime, not import time
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model=ANTHROPIC_HAIKU_MODEL,
            max_tokens=512,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )

        usage = getattr(resp, "usage", None)
        if usage:
            _record_spend(
                input_tokens=getattr(usage, "input_tokens", 0),
                output_tokens=getattr(usage, "output_tokens", 0),
            )

        text = "".join(
            getattr(b, "text", "") for b in resp.content if hasattr(b, "text")
        ).strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        rubric = orjson.loads(text)
        return {**rubric, "status": "ok"}

    except Exception as exc:
        return _fallback("error", str(exc))


def _fallback(reason: str, detail: str = "") -> dict:
    base = {"score": 50, "reason": f"Could not grade ({reason}). {detail}".strip()}
    return {
        "prompt_clarity": base.copy(),
        "token_efficiency": base.copy(),
        "agent_accuracy": base.copy(),
        "code_elegance": base.copy(),
        "status": reason,
    }
