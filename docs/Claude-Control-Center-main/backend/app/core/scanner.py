"""BackgroundScanner: shared base for periodic filesystem scanners.

Replaces the ad-hoc ``threading.Thread`` loops scattered across ~10 services.
Each scanner has a name, an interval, a scan function, and a cache path. The
scan function may return a value, in which case it is persisted atomically.

Includes a per-path mtime cache (Phase 5 perf): the ``should_rescan`` helper
lets a scan implementation skip files that haven't changed since the last run.
"""
from __future__ import annotations

import os
import threading
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from app.core.atomic_json import write_json_atomic

ScanFn = Callable[[], Any]


@dataclass
class ScannerStatus:
    name: str
    interval: float
    running: bool = False
    last_run_ts: float | None = None
    last_duration_ms: float | None = None
    last_error: str | None = None
    run_count: int = 0


@dataclass
class _MtimeCache:
    """Per-file mtime tracker so scanners can skip unchanged inputs."""
    seen: dict[str, float] = field(default_factory=dict)

    def changed(self, path: os.PathLike[str] | str) -> bool:
        p = Path(path)
        try:
            mtime = p.stat().st_mtime
        except OSError:
            return False
        key = str(p)
        prev = self.seen.get(key)
        if prev is not None and prev == mtime:
            return False
        self.seen[key] = mtime
        return True

    def reset(self) -> None:
        self.seen.clear()


class BackgroundScanner:
    """Run ``scan_fn`` on an interval in a daemon thread.

    Usage:
        scanner = BackgroundScanner("advisor", 30.0, _scan, cache_path)
        scanner.start()
        # later
        scanner.force_rescan()
        scanner.status()  # -> ScannerStatus
    """

    def __init__(
        self,
        name: str,
        interval: float,
        scan_fn: ScanFn,
        cache_path: Path | str | None = None,
        *,
        autostart: bool = False,
    ) -> None:
        self.name = name
        self.interval = float(interval)
        self._scan_fn = scan_fn
        self._cache_path = Path(cache_path) if cache_path else None
        self._status = ScannerStatus(name=name, interval=self.interval)
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self.mtime_cache = _MtimeCache()
        if autostart:
            self.start()

    # --- lifecycle ---------------------------------------------------------

    def start(self) -> None:
        with self._lock:
            if self._thread and self._thread.is_alive():
                return
            self._stop.clear()
            self._thread = threading.Thread(
                target=self._loop, name=f"scanner:{self.name}", daemon=True
            )
            self._thread.start()
            self._status.running = True

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()

    def force_rescan(self) -> None:
        """Wake the scan loop immediately."""
        self._wake.set()

    def status(self) -> ScannerStatus:
        return self._status

    # --- internals ---------------------------------------------------------

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._run_once()
            self._wake.wait(timeout=self.interval)
            self._wake.clear()
        self._status.running = False

    def _run_once(self) -> None:
        started = time.monotonic()
        try:
            result = self._scan_fn()
            if self._cache_path is not None and result is not None:
                write_json_atomic(self._cache_path, result)
            self._status.last_error = None
        except Exception:
            self._status.last_error = traceback.format_exc(limit=4)
        finally:
            self._status.last_run_ts = time.time()
            self._status.last_duration_ms = (time.monotonic() - started) * 1000
            self._status.run_count += 1
