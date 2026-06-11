"""Cost projection for analytics — the money-facing seam.

Per-message USD cost, cache savings, and task classification are all derived
from model pricing in ``codeburn_service``. Centralising the calls here keeps
the ingest pass free of pricing concerns and gives the cost logic one home.
"""
from __future__ import annotations

from app.services import codeburn_service


def message_cost(model: str, inp: int, out: int, cache_read: int, cache_creation: int) -> float:
    """USD cost of a single assistant message given its token usage."""
    return codeburn_service.calculate_cost(model, inp, out, cache_read, cache_creation)


def cache_savings(model: str, cache_read: int) -> float:
    """USD saved by cache reads on a single message."""
    return codeburn_service.calculate_cache_savings(model, cache_read)


def classify(summary: dict, user_text: str) -> str:
    """Bucket a session into a task category from its summary + user text."""
    return codeburn_service.classify_session(summary, user_text)
