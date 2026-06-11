"""Antigravity CLI provider adapter."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from app.providers.base import BaseProvider, Capability
from app.services import antigravity_memory_service as memory_service
from app.services import antigravity_session_scanner as scanner
from app.services import antigravity_settings_service as settings_service
from app.services import antigravity_skills_service as skills_service

_ANTIGRAVITY_DIR = Path(
    os.getenv("ANTIGRAVITY_DIR", str(Path.home() / ".gemini" / "antigravity-cli"))
)


class AntigravityProvider(BaseProvider):
    id = "antigravity"
    label = "Antigravity"
    data_dir = _ANTIGRAVITY_DIR
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
        return {"items": skills_service.list_skills()}

    def read_settings(self) -> Any:
        return settings_service.get_settings()

    def read_memory(self, **params: Any) -> Any:
        return {"items": memory_service.list_memory_files()}
