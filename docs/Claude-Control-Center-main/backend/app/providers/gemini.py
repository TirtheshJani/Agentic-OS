"""Gemini CLI provider adapter."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from app.providers.base import BaseProvider, Capability
from app.services import gemini_bridge_service
from app.services import gemini_session_scanner as scanner

_GEMINI_DIR = Path(os.getenv("GEMINI_DIR", str(Path.home() / ".gemini")))
_SETTINGS_PATH = _GEMINI_DIR / "settings.json"
_MEMORY_FILENAMES = ["memory.md", "MEMORY.md", "memory.json", "context.md"]


class GeminiProvider(BaseProvider):
    id = "gemini"
    label = "Gemini CLI"
    data_dir = _GEMINI_DIR
    capabilities = frozenset(
        {
            Capability.SESSIONS,
            Capability.SESSION_EVENTS,
            Capability.ANALYTICS,
            Capability.SKILLS,
            Capability.SETTINGS,
            Capability.MEMORY,
            Capability.SCAN,
        }
    )

    # -- sessions -------------------------------------------------------------
    def load_sessions(self) -> list[dict]:
        return scanner.get_sessions()

    def scan_sessions(self) -> dict:
        return scanner.trigger_scan()

    def get_session(self, session_id: str) -> dict | None:
        sessions = scanner.get_sessions()
        summary = next(
            (s for s in sessions if s.get("session_id") == session_id), None
        )
        if not summary:
            return None
        return {"summary": summary, "events": scanner.get_session_events(session_id)}

    # -- analytics ------------------------------------------------------------
    def session_stats(self, days: int | None) -> dict:
        return scanner.get_stats(scanner.get_sessions(), days)

    # -- skills / settings / memory ------------------------------------------
    def read_skills(self) -> Any:
        return gemini_bridge_service.get_status()

    def read_settings(self) -> Any:
        if not _SETTINGS_PATH.exists():
            return {}
        try:
            return json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def read_memory(self, **params: Any) -> Any:
        page = max(1, int(params.get("page", 1)))
        limit = max(1, min(int(params.get("limit", 50)), 200))
        search = str(params.get("search", "")).strip().lower()

        content = self._read_memory_file()
        if content is None:
            return {
                "total": 0,
                "page": page,
                "limit": limit,
                "items": [],
                "available": False,
            }

        entries = self._parse_memory_entries(content)
        if search:
            entries = [e for e in entries if search in e["text"].lower()]

        total = len(entries)
        offset = (page - 1) * limit
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": entries[offset : offset + limit],
            "available": True,
        }

    @staticmethod
    def _read_memory_file() -> str | None:
        for name in _MEMORY_FILENAMES:
            p = _GEMINI_DIR / name
            if p.exists():
                try:
                    return p.read_text(encoding="utf-8")
                except Exception:
                    continue
        return None

    @staticmethod
    def _parse_memory_entries(content: str) -> list[dict]:
        entries: list[dict] = []
        if not content:
            return entries
        for i, line in enumerate(content.splitlines()):
            line = line.strip()
            if line and not line.startswith("#"):
                entries.append({"id": i, "text": line, "source": "gemini-memory"})
        return entries
