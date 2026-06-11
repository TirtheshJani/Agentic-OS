"""
Lightweight mtime-based file watcher for SSE events.

Polls ~/.claude/sessions/ and active project JSONL files for changes.
Returns a list of WatcherEvent dicts on each poll() call.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.config import CLAUDE_DIR

_VIDEO_RESEARCH_FILE = Path(__file__).parent.parent.parent / "data" / "video_research_jobs.json"


@dataclass
class WatcherEvent:
    event_type: str  # "session_update" | "message_update" | "memory_update" | "video_research_update"
    data: dict[str, Any]


class Watcher:
    def __init__(self) -> None:
        self._session_snapshot: dict[str, float] = {}
        self._message_snapshot: dict[str, float] = {}
        self._video_research_mtime: float = 0.0
        self._initialized = False

    def _scan_sessions(self) -> dict[str, float]:
        sessions_dir = CLAUDE_DIR / "sessions"
        result: dict[str, float] = {}
        if sessions_dir.is_dir():
            for entry in os.scandir(sessions_dir):
                if entry.name.endswith(".json"):
                    result[entry.path] = entry.stat().st_mtime
        return result

    def _scan_project_jsonl(self) -> dict[str, float]:
        projects_dir = CLAUDE_DIR / "projects"
        result: dict[str, float] = {}
        if not projects_dir.is_dir():
            return result
        for proj_entry in os.scandir(projects_dir):
            if not proj_entry.is_dir():
                continue
            for f_entry in os.scandir(proj_entry.path):
                if f_entry.name.endswith(".jsonl"):
                    result[f_entry.path] = f_entry.stat().st_mtime
        return result

    def poll(self) -> list[WatcherEvent]:
        events: list[WatcherEvent] = []

        # --- Session changes ---
        current_sessions = self._scan_sessions()
        if self._initialized:
            for path, mtime in current_sessions.items():
                if path not in self._session_snapshot:
                    events.append(WatcherEvent("session_update", {"type": "new_session", "path": path}))
                elif self._session_snapshot[path] != mtime:
                    events.append(WatcherEvent("session_update", {"type": "session_changed", "path": path}))
            for path in self._session_snapshot:
                if path not in current_sessions:
                    events.append(WatcherEvent("session_update", {"type": "session_ended", "path": path}))

        # --- Message file changes ---
        current_messages = self._scan_project_jsonl()
        if self._initialized:
            for path, mtime in current_messages.items():
                if path not in self._message_snapshot:
                    p = Path(path)
                    project_id = p.parent.name
                    session_id = p.stem
                    events.append(WatcherEvent("message_update", {
                        "type": "new_session",
                        "projectId": project_id,
                        "sessionId": session_id,
                    }))
                elif self._message_snapshot[path] != mtime:
                    p = Path(path)
                    project_id = p.parent.name
                    session_id = p.stem
                    events.append(WatcherEvent("message_update", {
                        "type": "messages_added",
                        "projectId": project_id,
                        "sessionId": session_id,
                    }))

        # --- Video research jobs file ---
        try:
            current_vr_mtime = _VIDEO_RESEARCH_FILE.stat().st_mtime if _VIDEO_RESEARCH_FILE.exists() else 0.0
        except OSError:
            current_vr_mtime = 0.0
        if self._initialized and current_vr_mtime != self._video_research_mtime:
            events.append(WatcherEvent("video_research_update", {"mtime": current_vr_mtime}))
        self._video_research_mtime = current_vr_mtime

        self._session_snapshot = current_sessions
        self._message_snapshot = current_messages
        self._initialized = True
        return events
