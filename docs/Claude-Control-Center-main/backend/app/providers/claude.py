"""Claude Code provider adapter (alias-only in Phase 2).

Claude's canonical routes (``/api/skills``, ``/api/settings``,
``/api/analytics``, Conversations/Projects) remain the source of truth and are
untouched. This adapter exposes the cleanly-mappable read surface through the
unified ``/api/cli/claude/...`` namespace so Claude is a first-class registry
entry. Claude's flat-session browsing lives in Conversations/Projects, so the
SESSIONS capability is intentionally not declared here.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import frontmatter
import orjson

from app.config import CLAUDE_DIR
from app.providers.base import BaseProvider, Capability
from app.services import analytics_service

_SKILLS_DIR = CLAUDE_DIR / "skills"
_SETTINGS_PATH = CLAUDE_DIR / "settings.json"


class ClaudeProvider(BaseProvider):
    id = "claude"
    label = "Claude Code"
    data_dir = CLAUDE_DIR
    capabilities = frozenset(
        {
            Capability.ANALYTICS,
            Capability.SKILLS,
            Capability.SETTINGS,
        }
    )

    # -- analytics ------------------------------------------------------------
    def session_stats(self, days: int | None) -> dict:
        return analytics_service.build_stats(analytics_service.load(), days=days)

    # -- skills ---------------------------------------------------------------
    def read_skills(self) -> Any:
        if not _SKILLS_DIR.is_dir():
            return []
        results: list[dict] = []
        for entry in sorted(_SKILLS_DIR.iterdir()):
            if not entry.is_dir():
                continue
            skill = self._read_skill(entry)
            if skill:
                results.append(skill)
        return results

    @staticmethod
    def _read_skill(entry: Path) -> dict | None:
        skill_md = entry / "SKILL.md"
        name = entry.name
        description = ""
        body = ""
        if skill_md.exists():
            try:
                post = frontmatter.load(str(skill_md))
                name = post.metadata.get("name", entry.name)
                description = post.metadata.get("description", "")
                body = post.content
            except Exception:
                pass
        origin = {"originType": "local", "originLabel": "User Installed"}
        if entry.is_symlink() and ".agents/skills" in os.readlink(entry):
            origin = {"originType": "agent-marketplace", "originLabel": "Agent Marketplace"}
        return {
            "id": entry.name,
            "name": name,
            "description": description,
            "body": body,
            **origin,
        }

    # -- settings -------------------------------------------------------------
    def read_settings(self) -> Any:
        if not _SETTINGS_PATH.exists():
            return {}
        try:
            return orjson.loads(_SETTINGS_PATH.read_bytes())
        except Exception:
            return {}
