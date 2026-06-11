from __future__ import annotations

import logging
from importlib import import_module

from app.config import CCC_DISABLE_SCANNERS
from app.core import scanner_registry

logger = logging.getLogger(__name__)

# Each entry: (scanner name, module path, starter attr, default interval seconds | None).
# The name is the stable identifier used by CCC_DISABLE_SCANNERS and the
# /api/health/scanners endpoint. Interval is a best-effort hint for next_run;
# scanners may refine it via scanner_registry.heartbeat().
_BACKGROUND_STARTERS: tuple[tuple[str, str, str, float | None], ...] = (
    ("codex", "app.services.codex_tracker", "scan_all_background", None),
    ("advisor", "app.services.advisor_tracker", "scan_all_background", None),
    ("analytics", "app.services.analytics_service", "scan_all_background", None),
    ("routines", "app.services.routines_tracker", "scan_all_background", None),
    ("codex_cli_sessions", "app.services.codex_cli_session_scanner", "scan_all_background", None),
    ("gws_snapshot", "app.services.gws_snapshot_service", "start_background_refresh", 900.0),
    ("gws_activity", "app.services.gws_activity_scanner", "start_background_scan", None),
    ("antigravity_sessions", "app.services.antigravity_session_scanner", "scan_all_background", None),
    ("memory_rag_init", "app.services.memory_rag_service", "start_background_init", None),
    ("session_ingest", "app.services.session_ingest_service", "scan_all_background", 300.0),
    ("plans_ingest", "app.services.plans_ingest_watcher", "start", None),
    ("conversation_ingest", "app.services.conversation_ingest_scanner", "start_background_scan", None),
    ("plan_progress", "app.services.plan_progress_worker", "start", None),
    ("gemini_sessions", "app.services.gemini_session_scanner", "scan_all_background", None),
    ("obsidian_ingest", "app.services.obsidian_ingest_watcher", "start", None),
    ("github_snapshot", "app.services.github_snapshot_service", "start_background_refresh", 600.0),
    ("video_research_reset", "app.services.video_research_service", "startup_reset_running_jobs", None),
    ("eval", "app.services.eval_service", "scan_all_background", None),
    ("scheduler", "app.services.scheduler_service", "start_background_scheduler", 30.0),
)


def _disabled_names() -> set[str]:
    """Parse CCC_DISABLE_SCANNERS into the set of scanner names to skip."""
    raw = CCC_DISABLE_SCANNERS.lower()
    if not raw:
        return set()
    if raw in {"1", "all", "true", "yes"}:
        return {name for name, *_ in _BACKGROUND_STARTERS}
    return {part.strip() for part in raw.split(",") if part.strip()}


def start_background_services() -> None:
    """Launch background scanners, honouring CCC_DISABLE_SCANNERS.

    Every scanner is registered (enabled or not) so the health endpoint can
    report its status. Disabled scanners are recorded but never started; a
    starter that raises is recorded with its error and does not abort the rest.
    """
    disabled = _disabled_names()
    for name, module_path, attr_name, interval in _BACKGROUND_STARTERS:
        if name in disabled:
            scanner_registry.register(name, enabled=False, interval=interval)
            continue
        try:
            module = import_module(module_path)
            getattr(module, attr_name)()
            scanner_registry.register(name, enabled=True, interval=interval, started=True)
        except Exception as exc:  # pragma: no cover - defensive boot path
            logger.exception("Failed to start scanner %s", name)
            scanner_registry.register(
                name, enabled=True, interval=interval, start_error=str(exc)
            )
