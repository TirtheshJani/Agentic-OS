"""Polymorphic CLI provider model (Phase 2).

Every supported CLI assistant (Claude, Codex CLI, Gemini, Antigravity) is
described by a single :class:`CliProvider` implementation. The unified
``/api/cli/<provider>/...`` routes and the unified background scanner are
driven entirely off the registry of these objects, so adding a fifth provider
is a single new module plus one registry entry — no new blueprints, no new
scanner threads.

Provider methods return plain Python objects (dict / list); the route layer is
responsible for ``jsonify`` and HTTP status codes. Methods that a provider does
not support raise :class:`Unsupported`; capabilities are declared up-front via
:attr:`CliProvider.capabilities` so callers can branch without catching.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict


class Capability:
    """String constants for the optional parts of the provider surface."""

    SESSIONS = "sessions"
    SESSION_EVENTS = "session_events"
    SESSION_META = "session_meta"
    ANALYTICS = "analytics"
    SKILLS = "skills"
    SETTINGS = "settings"
    MEMORY = "memory"
    SCAN = "scan"


class Unsupported(Exception):
    """Raised when a provider is asked for a capability it does not declare."""

    def __init__(self, provider_id: str, capability: str) -> None:
        self.provider_id = provider_id
        self.capability = capability
        super().__init__(
            f"provider '{provider_id}' does not support capability '{capability}'"
        )


class SessionRecord(BaseModel):
    """Normalized cross-provider session summary.

    Providers store richer per-CLI dicts in their own caches; this model is the
    common subset the unified routes filter, sort and paginate on. Extra keys
    are preserved (``extra='allow'``) so provider-specific fields (model,
    source, starred, note, …) still round-trip through the generic layer.
    """

    model_config = ConfigDict(extra="allow")

    session_id: str
    project: str | None = None
    task_text: str | None = None
    first_ts: str | None = None
    last_ts: str | None = None
    duration_seconds: float | None = None
    total_tool_calls: int | None = None
    user_turn_count: int | None = None
    agent_turn_count: int | None = None
    model: str | None = None
    archived: bool | None = None
    starred: bool | None = None


@runtime_checkable
class CliProvider(Protocol):
    """The polymorphic interface every CLI stack implements.

    Identity / metadata
    -------------------
    ``id``           stable url-safe slug, e.g. ``"codex-cli"``
    ``label``        human-facing name, e.g. ``"Codex CLI"``
    ``data_dir``     root directory the provider reads from
    ``capabilities`` frozenset of :class:`Capability` values it supports
    """

    id: str
    label: str
    data_dir: Path
    capabilities: frozenset[str]

    # -- sessions -------------------------------------------------------------
    def load_sessions(self) -> list[dict]:
        """Return cached session summaries (fully merged, e.g. user meta)."""
        ...

    def scan_sessions(self) -> dict:
        """Rescan the filesystem, refresh the cache, return ``{scanned, stats}``."""
        ...

    def get_session(self, session_id: str) -> dict | None:
        """Return ``{"summary": ..., "events": [...]}`` or ``None`` if missing."""
        ...

    def update_session_meta(self, session_id: str, changes: dict) -> dict:
        """Persist user metadata (starred/archived/note). Requires SESSION_META."""
        ...

    # -- analytics ------------------------------------------------------------
    def session_stats(self, days: int | None) -> dict:
        """Aggregate analytics over the cached sessions for the last *days*."""
        ...

    # -- skills / settings / memory ------------------------------------------
    def read_skills(self) -> Any:
        """Return the provider's primary skills payload."""
        ...

    def read_settings(self) -> Any:
        """Return the provider's primary settings payload."""
        ...

    def read_memory(self, **params: Any) -> Any:
        """Return the provider's primary memory payload."""
        ...


class BaseProvider:
    """Convenience base giving every adapter capability-checking + sane defaults.

    Concrete adapters override only the methods for capabilities they declare.
    The defaults raise :class:`Unsupported`, so a provider that forgets to
    implement a declared capability fails loudly rather than silently.
    """

    id: str = ""
    label: str = ""
    data_dir: Path = Path()
    capabilities: frozenset[str] = frozenset()

    def supports(self, capability: str) -> bool:
        return capability in self.capabilities

    def require(self, capability: str) -> None:
        if capability not in self.capabilities:
            raise Unsupported(self.id, capability)

    # Default implementations — overridden per provider as needed.
    def load_sessions(self) -> list[dict]:
        raise Unsupported(self.id, Capability.SESSIONS)

    def scan_sessions(self) -> dict:
        raise Unsupported(self.id, Capability.SCAN)

    def get_session(self, session_id: str) -> dict | None:
        raise Unsupported(self.id, Capability.SESSIONS)

    def update_session_meta(self, session_id: str, changes: dict) -> dict:
        raise Unsupported(self.id, Capability.SESSION_META)

    def session_stats(self, days: int | None) -> dict:
        raise Unsupported(self.id, Capability.ANALYTICS)

    def read_skills(self) -> Any:
        raise Unsupported(self.id, Capability.SKILLS)

    def read_settings(self) -> Any:
        raise Unsupported(self.id, Capability.SETTINGS)

    def read_memory(self, **params: Any) -> Any:
        raise Unsupported(self.id, Capability.MEMORY)

    def to_metadata(self) -> dict:
        """Serializable descriptor for the ``/api/cli/providers`` listing."""
        return {
            "id": self.id,
            "label": self.label,
            "data_dir": str(self.data_dir),
            "capabilities": sorted(self.capabilities),
        }
