"""Orchestration + persistence for the Model A/B Bench.

Fans one prompt out across the selected models (run concurrently), assembles a
run record, and persists the history to ``backend/data/bench_runs.json`` using
the ``.tmp`` -> ``os.replace()`` atomic pattern.

Run record shape::

    {
        "id": str,
        "created_at": iso8601,
        "prompt": str,
        "blind": bool,
        "entries": [
            {"label": "A", "model": ..., "provider": ..., "text": ...,
             "input_tokens": ..., "output_tokens": ..., "latency_ms": ...,
             "cost_usd": ..., "error": ...},
            ...
        ],
        "vote": str | None,     # winning label, set by record_vote
        "revealed": bool,       # True once voted or explicitly revealed
    }

In blind mode entries are addressed by opaque labels (A/B/C/...) and model
identity is withheld from the public view until the run is voted or revealed
(see :func:`public_run`). Full identity is always persisted so a later reveal —
and the Evals integration — can recover it.
"""
from __future__ import annotations

import string
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.services import bench_budget, bench_providers

_RUNS_PATH = Path(__file__).parent.parent.parent / "data" / "bench_runs.json"
_lock = threading.Lock()

# Fields hidden from a blind, not-yet-revealed run's public view.
_HIDDEN_WHEN_BLIND = ("model", "provider")


# ---------------------------------------------------------------------------
# Persistence (atomic, lock-guarded)
# ---------------------------------------------------------------------------

def _read() -> list[dict]:
    try:
        data = orjson.loads(_RUNS_PATH.read_bytes())
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _write(runs: list[dict]) -> None:
    _RUNS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _RUNS_PATH.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(runs))
    tmp.replace(_RUNS_PATH)


def _label_for(index: int) -> str:
    """A, B, ..., Z, AA, AB, ... opaque label for the *index*-th entry."""
    letters = string.ascii_uppercase
    label = ""
    n = index
    while True:
        label = letters[n % 26] + label
        n = n // 26 - 1
        if n < 0:
            break
    return label


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_runs() -> list[dict]:
    """All runs, newest first."""
    with _lock:
        runs = _read()
    runs.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return runs


def get_run(run_id: str) -> dict | None:
    with _lock:
        for run in _read():
            if run.get("id") == run_id:
                return run
    return None


def create_run(prompt: str, models: list[str], blind: bool = False) -> dict:
    """Fan *prompt* across *models* concurrently and persist the assembled run.

    Each model becomes one entry with a stable opaque label (A/B/C/...).
    Providers price/time themselves inside ``bench_providers.invoke`` and never
    raise, so a single failing model yields an entry with its ``error`` set
    rather than aborting the run.
    """
    models = [m for m in models if m]
    if not models:
        raise ValueError("at least one model is required")

    # Gate on the daily spend cap before spending any tokens. Raises
    # BudgetExhaustedError, which the route maps to HTTP 429.
    bench_budget.check_budget()

    # Preserve the caller's model order so labels are deterministic, while
    # still running the calls concurrently.
    with ThreadPoolExecutor(max_workers=len(models)) as pool:
        results = list(pool.map(lambda m: bench_providers.invoke(m, prompt), models))

    entries = []
    for i, res in enumerate(results):
        entry = {"label": _label_for(i)}
        entry.update(res)
        entries.append(entry)

    run = {
        "id": uuid.uuid4().hex[:12],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "prompt": prompt,
        "blind": bool(blind),
        "entries": entries,
        "vote": None,
        "revealed": not bool(blind),
    }

    with _lock:
        runs = _read()
        runs.append(run)
        _write(runs)

    # Record actual spend across all entries (errored entries cost nothing).
    bench_budget.record_spend(
        cost_usd=sum(e.get("cost_usd", 0.0) for e in entries),
        input_tokens=sum(e.get("input_tokens", 0) for e in entries),
        output_tokens=sum(e.get("output_tokens", 0) for e in entries),
    )
    return run


def record_vote(run_id: str, label: str) -> dict | None:
    """Record the winning *label* for a run. Voting also reveals identities."""
    with _lock:
        runs = _read()
        for run in runs:
            if run.get("id") != run_id:
                continue
            valid = {e["label"] for e in run.get("entries", [])}
            if label not in valid:
                raise ValueError(f"unknown label '{label}' for run {run_id}")
            run["vote"] = label
            run["revealed"] = True
            _write(runs)
            return run
    return None


def reveal(run_id: str) -> dict | None:
    """Reveal model identities for a blind run without casting a vote."""
    with _lock:
        runs = _read()
        for run in runs:
            if run.get("id") != run_id:
                continue
            run["revealed"] = True
            _write(runs)
            return run
    return None


def public_run(run: dict | None) -> dict | None:
    """A copy of *run* safe to send to the client.

    For a blind run that hasn't been revealed, model/provider identity is
    stripped from every entry so the UI shows only opaque labels.
    """
    if run is None:
        return None
    view = deepcopy(run)
    if view.get("blind") and not view.get("revealed"):
        for entry in view.get("entries", []):
            for field in _HIDDEN_WHEN_BLIND:
                entry.pop(field, None)
    return view
