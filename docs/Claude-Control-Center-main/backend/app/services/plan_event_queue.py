from __future__ import annotations

import fcntl
import threading
import time
from pathlib import Path

import orjson

_QUEUE_FILE = Path(__file__).parent.parent.parent / "data" / "plan_events.jsonl"
_MAX_LINES = 10_000
_lock = threading.Lock()


def _ensure_file() -> None:
    _QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not _QUEUE_FILE.exists():
        _QUEUE_FILE.touch()


def append(event: dict) -> None:
    """Append a single event to the queue. Thread-safe, file-locked."""
    _ensure_file()
    line = orjson.dumps(event) + b"\n"
    with _lock:
        with open(_QUEUE_FILE, "a+b") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            try:
                # Check line count and trim if over cap
                f.seek(0)
                all_bytes = f.read()
                existing_lines = all_bytes.splitlines(keepends=True)
                if len(existing_lines) >= _MAX_LINES:
                    # Keep the most recent lines, drop oldest
                    keep = existing_lines[-(_MAX_LINES - 1):]
                    f.seek(0)
                    f.truncate()
                    f.writelines(keep)
                # Append new line
                f.seek(0, 2)  # end of file
                f.write(line)
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)


def drain(n: int = 20, timeout: float = 30) -> list[dict]:
    """Read and consume up to n events from the queue.

    Acquires exclusive file lock, reads all lines, truncates file, then
    releases the lock. Returns the consumed events.
    """
    _ensure_file()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with _lock:
            with open(_QUEUE_FILE, "r+b") as f:
                fcntl.flock(f, fcntl.LOCK_EX)
                try:
                    all_bytes = f.read()
                    all_lines = all_bytes.splitlines(keepends=True)
                    if not all_lines:
                        return []
                    consumed_lines = all_lines[:n]
                    remaining_lines = all_lines[n:]
                    # Parse consumed
                    events: list[dict] = []
                    for raw in consumed_lines:
                        raw = raw.strip()
                        if not raw:
                            continue
                        try:
                            events.append(orjson.loads(raw))
                        except Exception:
                            pass
                    # Rewrite file with remaining
                    f.seek(0)
                    f.truncate()
                    f.writelines(remaining_lines)
                    return events
                finally:
                    fcntl.flock(f, fcntl.LOCK_UN)
    return []
