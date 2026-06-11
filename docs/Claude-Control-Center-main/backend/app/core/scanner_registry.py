"""Lightweight registry tracking background-scanner lifecycle.

The app spins up ~20 daemon threads that scan the filesystem on intervals.
Historically there was no way to inspect whether they were alive, when they
last ran, or whether they had failed. This registry gives each scanner a small
record that ``start_background_services`` populates at boot and that scanners
update via :func:`heartbeat` as they run.

Records are intentionally cheap and lock-protected so any daemon thread can
report without coordination. The ``/api/health/scanners`` endpoint serialises
:func:`snapshot` for observability.
"""
from __future__ import annotations

import threading
import time
from dataclasses import asdict, dataclass, field

_lock = threading.Lock()
_registry: dict[str, "ScannerRecord"] = {}


@dataclass
class ScannerRecord:
    name: str
    enabled: bool = True
    interval: float | None = None
    started_at: float | None = None
    last_run: float | None = None
    last_error: str | None = None
    start_error: str | None = None
    run_count: int = 0

    @property
    def next_run(self) -> float | None:
        """Best-effort estimate of the next run wall-clock time."""
        if not self.enabled or self.interval is None:
            return None
        anchor = self.last_run if self.last_run is not None else self.started_at
        if anchor is None:
            return None
        return anchor + self.interval


def register(
    name: str,
    *,
    enabled: bool = True,
    interval: float | None = None,
    started: bool = False,
    start_error: str | None = None,
) -> None:
    """Record (or update) a scanner's boot-time metadata."""
    with _lock:
        rec = _registry.get(name) or ScannerRecord(name=name)
        rec.enabled = enabled
        rec.interval = interval
        rec.start_error = start_error
        if started and rec.started_at is None:
            rec.started_at = time.time()
        _registry[name] = rec


def heartbeat(name: str, *, error: str | None = None, interval: float | None = None) -> None:
    """Called by a scanner after each run to record success or failure."""
    with _lock:
        rec = _registry.get(name) or ScannerRecord(name=name)
        rec.last_run = time.time()
        rec.last_error = error
        rec.run_count += 1
        if interval is not None:
            rec.interval = interval
        _registry[name] = rec


def snapshot() -> list[dict]:
    """Return a JSON-serialisable list of all scanner records, sorted by name."""
    with _lock:
        records = sorted(_registry.values(), key=lambda r: r.name)
        return [{**asdict(r), "next_run": r.next_run} for r in records]


def reset() -> None:
    """Clear the registry (test helper)."""
    with _lock:
        _registry.clear()
