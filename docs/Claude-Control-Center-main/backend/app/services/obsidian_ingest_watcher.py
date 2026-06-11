from __future__ import annotations

"""Watchdog watcher: ingest Obsidian vault notes into the shared RAG."""

import logging
import threading
import time
from pathlib import Path

from app.config import ANTHROPIC_API_KEY
from app.services import obsidian_vault_service

logger = logging.getLogger(__name__)

_DEBOUNCE_SECONDS = 2.0
_CONFIG_POLL_INTERVAL = 60  # seconds

_started = False
_start_lock = threading.Lock()

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer as _Observer

    _WATCHDOG_AVAILABLE = True
except ImportError:
    _WATCHDOG_AVAILABLE = False


def _ingest(vault_id: str, vault_name: str, path: Path, vault_path: Path) -> None:
    try:
        from app.services import memory_rag_service
        status = memory_rag_service.get_status().get("status", "")
        if status != "ready":
            return
        content = path.read_text(encoding="utf-8", errors="ignore")
        rel = str(path.relative_to(vault_path))
        memory_rag_service.insert(
            content,
            source=f"obsidian:{vault_id}:{rel}",
            tags=["obsidian", vault_name],
        )
        # Update last_synced
        obsidian_vault_service.update_vault(vault_id, last_synced=__import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat())
        logger.debug("obsidian_ingest_watcher: ingested %s/%s", vault_name, rel)
    except Exception as exc:
        logger.debug("obsidian_ingest_watcher: ingest error %s: %s", path, exc)


if _WATCHDOG_AVAILABLE:
    class _VaultHandler(FileSystemEventHandler):  # type: ignore[name-defined]
        def __init__(self, vault_id: str, vault_name: str, vault_path: Path) -> None:
            super().__init__()
            self.vault_id = vault_id
            self.vault_name = vault_name
            self.vault_path = vault_path
            self._timers: dict[str, threading.Timer] = {}
            self._lock = threading.Lock()

        def _schedule(self, path_str: str) -> None:
            path = Path(path_str)
            if path.suffix != ".md":
                return
            with self._lock:
                existing = self._timers.pop(path_str, None)
                if existing:
                    existing.cancel()
                t = threading.Timer(
                    _DEBOUNCE_SECONDS,
                    _ingest,
                    args=(self.vault_id, self.vault_name, path, self.vault_path),
                )
                t.daemon = True
                self._timers[path_str] = t
                t.start()

        def on_created(self, event):
            if not event.is_directory:
                self._schedule(event.src_path)

        def on_modified(self, event):
            if not event.is_directory:
                self._schedule(event.src_path)


def _manage_watchers() -> None:
    """Poll vault config every 60s and start/stop observers as vaults change."""
    observers: dict[str, object] = {}  # vault_id → Observer

    while True:
        try:
            vaults = obsidian_vault_service.list_vaults()
            enabled_ids = {v["id"] for v in vaults if v.get("enabled")}

            # Stop observers for removed/disabled vaults
            for vid in list(observers.keys()):
                if vid not in enabled_ids:
                    obs = observers.pop(vid)
                    try:
                        obs.stop()  # type: ignore[attr-defined]
                    except Exception:
                        pass

            # Start observers for new vaults
            for vault in vaults:
                if not vault.get("enabled"):
                    continue
                vid = vault["id"]
                if vid in observers:
                    continue
                vault_path = Path(vault["path"])
                if not vault_path.exists():
                    continue
                obs = _Observer()  # type: ignore[name-defined]
                handler = _VaultHandler(vid, vault.get("name", vid), vault_path)  # type: ignore[name-defined]
                obs.schedule(handler, str(vault_path), recursive=True)
                obs.start()
                observers[vid] = obs
                logger.info("obsidian_ingest_watcher: watching vault '%s' at %s", vault.get("name"), vault_path)

        except Exception as exc:
            logger.warning("obsidian_ingest_watcher: watcher management error: %s", exc)

        time.sleep(_CONFIG_POLL_INTERVAL)


def start() -> None:
    """Launch the Obsidian ingest watcher. No-op if watchdog missing or no API key."""
    global _started
    with _start_lock:
        if _started:
            return
        if not _WATCHDOG_AVAILABLE:
            logger.info("obsidian_ingest_watcher: watchdog not available, skipping")
            return
        if not ANTHROPIC_API_KEY:
            logger.info("obsidian_ingest_watcher: no ANTHROPIC_API_KEY, skipping")
            return
        _started = True

    t = threading.Thread(target=_manage_watchers, daemon=True, name="obsidian-ingest-watcher")
    t.start()
    logger.info("obsidian_ingest_watcher: started")
