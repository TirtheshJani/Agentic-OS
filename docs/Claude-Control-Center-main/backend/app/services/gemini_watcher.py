from __future__ import annotations

"""Mtime-based watcher for ~/.gemini/ JSONL session files. Drives the Gemini SSE endpoint."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class GeminiWatcherEvent:
    event_type: str  # gemini_session_new | gemini_session_updated | gemini_session_ended
    data: dict[str, Any]


class GeminiWatcher:
    def __init__(self) -> None:
        self._gemini_dir = Path(os.getenv("GEMINI_DIR", str(Path.home() / ".gemini")))
        self._snapshot: dict[str, float] = {}
        self._initialized = False

    def _scan(self) -> dict[str, float]:
        result: dict[str, float] = {}
        for subdir_name in ("tmp", "history"):
            subdir = self._gemini_dir / subdir_name
            if not subdir.is_dir():
                continue
            for entry in subdir.rglob("*.jsonl"):
                try:
                    result[str(entry)] = entry.stat().st_mtime
                except OSError:
                    pass
        return result

    def _path_info(self, path: str) -> dict[str, str]:
        p = Path(path)
        project = p.parent.parent.name if p.parent.name == "chats" else p.parent.name
        return {"session_id": p.stem, "project": project, "filepath": path}

    def poll(self) -> list[GeminiWatcherEvent]:
        events: list[GeminiWatcherEvent] = []
        current = self._scan()

        if self._initialized:
            for path, mtime in current.items():
                if path not in self._snapshot:
                    events.append(GeminiWatcherEvent("gemini_session_new", self._path_info(path)))
                elif self._snapshot[path] != mtime:
                    events.append(GeminiWatcherEvent("gemini_session_updated", self._path_info(path)))
            for path in self._snapshot:
                if path not in current:
                    events.append(GeminiWatcherEvent("gemini_session_ended", self._path_info(path)))

        self._snapshot = current
        self._initialized = True
        return events
