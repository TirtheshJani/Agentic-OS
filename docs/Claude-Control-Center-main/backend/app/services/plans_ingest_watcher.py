from __future__ import annotations

"""Watchdog-based watcher: ingest plan markdown files into the shared RAG."""

import logging
import threading
import time
from pathlib import Path

from app.config import ANTHROPIC_API_KEY, CLAUDE_DIR

logger = logging.getLogger(__name__)

_started = False
_start_lock = threading.Lock()

_DEBOUNCE_SECONDS = 2.0
_SKIP_DIRS = {".progress", ".active", "completed"}


def _plans_dir() -> Path:
    return CLAUDE_DIR / "plans"


def _ingest(path: Path) -> None:
    """Read file and insert into RAG."""
    try:
        from app.services import memory_rag_service
        status = memory_rag_service.get_status().get("status", "")
        if status not in ("ready",):
            return
        content = path.read_text(encoding="utf-8")
        slug = path.stem
        memory_rag_service.insert(content, source=f"plan:{slug}", tags=["plan"])
        logger.debug("plans_ingest_watcher: ingested plan '%s'", slug)
    except Exception as exc:
        logger.debug("plans_ingest_watcher: ingest error for %s: %s", path, exc)


try:
    from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileModifiedEvent
    from watchdog.observers import Observer as _Observer

    class _PlanHandler(FileSystemEventHandler):
        def __init__(self) -> None:
            super().__init__()
            self._timers: dict[str, threading.Timer] = {}
            self._lock = threading.Lock()

        def _schedule(self, path_str: str) -> None:
            path = Path(path_str)
            # Skip non-md files and skipped subdirs
            if path.suffix != ".md":
                return
            for part in path.parts:
                if part in _SKIP_DIRS:
                    return

            with self._lock:
                existing = self._timers.pop(path_str, None)
                if existing:
                    existing.cancel()
                t = threading.Timer(_DEBOUNCE_SECONDS, _ingest, args=(path,))
                t.daemon = True
                self._timers[path_str] = t
                t.start()

        def on_created(self, event):
            if not event.is_directory:
                self._schedule(event.src_path)

        def on_modified(self, event):
            if not event.is_directory:
                self._schedule(event.src_path)

    _WATCHDOG_AVAILABLE = True

except ImportError:
    _WATCHDOG_AVAILABLE = False


def start() -> None:
    """Launch the watchdog observer. No-op if watchdog missing or no API key."""
    global _started
    with _start_lock:
        if _started:
            return
        if not _WATCHDOG_AVAILABLE:
            logger.info("plans_ingest_watcher: watchdog not available, skipping")
            return
        if not ANTHROPIC_API_KEY:
            logger.info("plans_ingest_watcher: no ANTHROPIC_API_KEY, skipping")
            return
        _started = True

    def _run() -> None:
        plans_dir = _plans_dir()
        plans_dir.mkdir(parents=True, exist_ok=True)
        observer = _Observer()  # type: ignore[name-defined]
        handler = _PlanHandler()  # type: ignore[name-defined]
        observer.schedule(handler, str(plans_dir), recursive=True)
        observer.start()
        logger.info("plans_ingest_watcher: watching %s", plans_dir)
        try:
            while True:
                time.sleep(60)
        except Exception:
            observer.stop()
        observer.join()

    t = threading.Thread(target=_run, daemon=True, name="plans-ingest-watcher")
    t.start()
