"""Daily USD budget guard for the Model A/B Bench.

Bench runs spend real API tokens across multiple providers, so a run is gated
by a per-UTC-day cap (``BENCH_DAILY_BUDGET_USD``). Mirrors the
``memory_rag_budget`` / ``eval_judge_service._check_budget`` pattern: load
today's accounting, check before a run, increment after.

Persistence (load/save, atomic .tmp -> replace, daily reset) is reused from
``memory_rag_budget``; this module owns the cap, the lock, and the
exhausted-state error the route maps to a 429.
"""
from __future__ import annotations

import threading
from pathlib import Path

from app.config import BENCH_DAILY_BUDGET_USD
from app.services.memory_rag_budget import load_budget, save_budget, today_utc

_BUDGET_PATH = Path(__file__).parent.parent.parent / "data" / "bench_budget.json"
_lock = threading.Lock()


class BudgetExhaustedError(RuntimeError):
    """Raised when the bench daily spend cap is reached (route -> HTTP 429)."""


def check_budget() -> None:
    """Raise :class:`BudgetExhaustedError` if today's spend is at/over the cap."""
    with _lock:
        budget = load_budget(_BUDGET_PATH)
        if budget.get("spent_usd", 0.0) >= BENCH_DAILY_BUDGET_USD:
            raise BudgetExhaustedError(
                f"Bench daily budget exhausted "
                f"(${budget['spent_usd']:.4f} / ${BENCH_DAILY_BUDGET_USD:.2f})"
            )


def record_spend(cost_usd: float, input_tokens: int = 0, output_tokens: int = 0) -> None:
    """Add a run's measured cost (and token usage) to today's accounting."""
    if cost_usd <= 0 and not input_tokens and not output_tokens:
        return
    with _lock:
        budget = load_budget(_BUDGET_PATH)
        budget["spent_usd"] = round(budget.get("spent_usd", 0.0) + max(0.0, cost_usd), 6)
        budget["input_tokens"] = budget.get("input_tokens", 0) + max(0, input_tokens)
        budget["output_tokens"] = budget.get("output_tokens", 0) + max(0, output_tokens)
        save_budget(_BUDGET_PATH, budget)


def get_budget_status() -> dict:
    """Current accounting for today, for /api/bench/budget and pre-run checks."""
    with _lock:
        budget = load_budget(_BUDGET_PATH)
    spent = budget.get("spent_usd", 0.0)
    return {
        "day": budget.get("day", today_utc()),
        "spent_usd": spent,
        "limit_usd": BENCH_DAILY_BUDGET_USD,
        "remaining_usd": max(0.0, BENCH_DAILY_BUDGET_USD - spent),
        "exhausted": spent >= BENCH_DAILY_BUDGET_USD,
    }
