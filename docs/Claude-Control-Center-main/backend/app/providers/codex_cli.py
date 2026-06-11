"""Codex CLI provider adapter.

Delegates to the existing ``codex_cli_*`` services so the unified
``/api/cli/codex-cli/...`` routes and the legacy ``/api/codex-cli/...``
aliases share one implementation.
"""

from __future__ import annotations

from typing import Any

import orjson

from app.config import CODEX_DIR
from app.providers.base import BaseProvider, Capability
from app.services import codex_cli_memory_reader as memory_reader
from app.services import codex_cli_session_meta as session_meta
from app.services import codex_cli_session_scanner as scanner
from app.services import codex_cli_settings_reader as settings_reader
from app.services import codex_cli_skills_reader as skills_reader

_META_FIELDS = {"starred", "archived", "note"}


class CodexCliProvider(BaseProvider):
    id = "codex-cli"
    label = "Codex CLI"
    data_dir = CODEX_DIR
    capabilities = frozenset(
        {
            Capability.SESSIONS,
            Capability.SESSION_EVENTS,
            Capability.SESSION_META,
            Capability.ANALYTICS,
            Capability.SKILLS,
            Capability.SETTINGS,
            Capability.MEMORY,
            Capability.SCAN,
        }
    )

    # -- sessions -------------------------------------------------------------
    def load_sessions(self) -> list[dict]:
        meta_map = session_meta.load_all()
        return [session_meta.merge(s, meta_map) for s in scanner.load()]

    def scan_sessions(self) -> dict:
        sessions = scanner.scan_all()
        return {"scanned": len(sessions), "stats": scanner.build_stats(sessions)}

    def get_session(self, session_id: str) -> dict | None:
        sessions = scanner.load()
        meta_map = session_meta.load_all()
        summary = next(
            (
                session_meta.merge(s, meta_map)
                for s in sessions
                if s.get("session_id") == session_id
            ),
            None,
        )
        if not summary:
            return None

        filepath = CODEX_DIR / summary["filepath"]
        if not filepath.exists():
            return {"summary": summary, "events": []}

        events: list[dict] = []
        try:
            with open(filepath, "rb") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        event = orjson.loads(line)
                    except Exception:
                        continue

                    etype = event.get("type")
                    payload = event.get("payload") or {}

                    if etype == "session_meta":
                        stripped = {
                            k: v for k, v in payload.items() if k != "base_instructions"
                        }
                        events.append(
                            {"timestamp": event.get("timestamp"), "type": etype, "payload": stripped}
                        )
                    elif etype == "event_msg":
                        events.append(
                            {"timestamp": event.get("timestamp"), "type": etype, "payload": payload}
                        )
                    elif etype == "response_item":
                        if payload.get("type") == "function_call":
                            args = payload.get("arguments") or ""
                            stripped_payload = {
                                **payload,
                                "arguments": args[:200]
                                if isinstance(args, str)
                                else str(args)[:200],
                            }
                            events.append(
                                {
                                    "timestamp": event.get("timestamp"),
                                    "type": etype,
                                    "payload": stripped_payload,
                                }
                            )
                        elif payload.get("role") in ("user", "assistant"):
                            events.append(
                                {"timestamp": event.get("timestamp"), "type": etype, "payload": payload}
                            )
        except Exception as exc:
            return {"summary": summary, "events": [], "error": str(exc)}

        return {"summary": summary, "events": events}

    def update_session_meta(self, session_id: str, changes: dict) -> dict:
        updates = {k: changes[k] for k in _META_FIELDS if k in changes}
        if not updates:
            raise ValueError("no supported fields provided")
        return session_meta.update(session_id, updates)

    # -- analytics ------------------------------------------------------------
    def session_stats(self, days: int | None) -> dict:
        return scanner.build_stats(scanner.load(), days)

    # -- skills / settings / memory ------------------------------------------
    def read_skills(self) -> Any:
        return skills_reader.list_skills()

    def read_settings(self) -> Any:
        return {
            "auth": settings_reader.read_auth(),
            "config": settings_reader.read_config(),
            "version": settings_reader.read_version(),
            "models": settings_reader.read_models(),
        }

    def read_memory(self, **params: Any) -> Any:
        page = int(params.get("page", 1))
        limit = int(params.get("limit", 50))
        search = str(params.get("search", "")).strip()
        return memory_reader.read_history(limit=limit, page=page, search=search)
