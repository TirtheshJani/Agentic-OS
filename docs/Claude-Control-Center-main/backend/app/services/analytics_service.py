"""
Analytics service (facade).

Scans all session JSONL files under ~/.claude/projects/ and computes usage
analytics: token counts, tool calls, activity patterns, plan-mode detection,
and improvement insights. Session summaries are cached in
backend/data/analytics_stats.json.

The work is split across three focused modules:
  - ``analytics_ingest``      — JSONL -> per-session summaries
  - ``analytics_aggregation`` — summaries -> dashboard stats + insights
  - ``analytics_cost``        — per-message USD cost / classification

:class:`AnalyticsService` wires them together with constructor-injected
``claude_dir``, ``data_file`` and ``clock`` so it can be exercised against a
temp tree in isolation. Module-level functions delegate to a lazily-created
default instance to preserve the historical ``analytics_service.load()`` API.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import orjson

from app.config import CLAUDE_DIR
from app.core import scanner_registry
from app.services import analytics_aggregation, analytics_ingest

_DEFAULT_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "analytics_stats.json"

Clock = Callable[[], datetime]


class AnalyticsService:
    """Scan/aggregate session analytics with injectable filesystem + clock."""

    def __init__(
        self,
        *,
        claude_dir: Path | str | None = None,
        data_file: Path | str | None = None,
        clock: Clock | None = None,
    ) -> None:
        self._claude_dir = Path(claude_dir) if claude_dir is not None else Path(CLAUDE_DIR)
        self._data_file = Path(data_file) if data_file is not None else _DEFAULT_DATA_FILE
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._lock = threading.Lock()

    @property
    def projects_dir(self) -> Path:
        return self._claude_dir / "projects"

    # --- scan / persistence ------------------------------------------------

    def scan_all(self) -> list[dict]:
        """Scan every session JSONL and cache the summaries."""
        summaries = analytics_ingest.scan_projects(self.projects_dir)
        self._save(summaries)
        scanner_registry.heartbeat("analytics")
        return summaries

    def load(self) -> list[dict]:
        """Load cached summaries; return empty list if none yet."""
        if not self._data_file.exists():
            return []
        try:
            return orjson.loads(self._data_file.read_bytes())
        except Exception:
            return []

    def _save(self, summaries: list[dict]) -> None:
        with self._lock:
            self._data_file.parent.mkdir(parents=True, exist_ok=True)
            self._data_file.write_bytes(orjson.dumps(summaries, option=orjson.OPT_INDENT_2))

    # --- aggregation -------------------------------------------------------

    def build_stats(self, summaries: list[dict], days: int | None = 30) -> dict:
        return analytics_aggregation.build_stats(summaries, days, now=self._clock())

    # --- lifecycle ---------------------------------------------------------

    def scan_all_background(self) -> None:
        t = threading.Thread(target=self.scan_all, daemon=True, name="analytics-scanner")
        t.start()


# ---------------------------------------------------------------------------
# Default instance + module-level shims (back-compat surface)
# ---------------------------------------------------------------------------

_default: AnalyticsService | None = None
_default_lock = threading.Lock()


def get_analytics_service() -> AnalyticsService:
    """Return the process-wide default AnalyticsService (lazily created)."""
    global _default
    if _default is None:
        with _default_lock:
            if _default is None:
                _default = AnalyticsService()
    return _default


def scan_all() -> list[dict]:
    return get_analytics_service().scan_all()


def load() -> list[dict]:
    return get_analytics_service().load()


def build_stats(summaries: list[dict], days: int | None = 30) -> dict:
    return get_analytics_service().build_stats(summaries, days=days)


def scan_all_background() -> None:
    get_analytics_service().scan_all_background()
