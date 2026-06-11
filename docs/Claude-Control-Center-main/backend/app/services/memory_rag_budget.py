"""Daily USD budget accounting for the memory RAG service.

Pure persistence + pricing maths over an explicit budget file path. Status
transitions (e.g. flipping to ``budget_exhausted``) stay with the owning
service; this module only loads, saves, and prices.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import orjson

# Haiku 4.5 list pricing (USD per 1M tokens) — APPROXIMATE.
# Used for budget *accounting*; the hard safety is the cap itself.
HAIKU_INPUT_USD_PER_MTOK = 1.00
HAIKU_OUTPUT_USD_PER_MTOK = 5.00

Clock = Callable[[], datetime]


def today_utc(clock: Clock | None = None) -> str:
    now = clock() if clock else datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d")


def _fresh(day: str) -> dict[str, Any]:
    return {"day": day, "spent_usd": 0.0, "input_tokens": 0, "output_tokens": 0}


def load_budget(path: Path, clock: Clock | None = None) -> dict[str, Any]:
    """Load today's budget, resetting if the file is missing/stale/corrupt."""
    today = today_utc(clock)
    if not path.exists():
        return _fresh(today)
    try:
        data = orjson.loads(path.read_bytes())
    except Exception:
        return _fresh(today)
    if data.get("day") != today:
        return _fresh(today)
    return data


def save_budget(path: Path, budget: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(budget))
    tmp.replace(path)


def cost_usd(input_tokens: int, output_tokens: int) -> float:
    """USD cost of a Haiku call given its token usage."""
    return (
        input_tokens / 1_000_000 * HAIKU_INPUT_USD_PER_MTOK
        + output_tokens / 1_000_000 * HAIKU_OUTPUT_USD_PER_MTOK
    )
