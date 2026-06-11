"""Tests for the Phase 2 CLI provider abstraction."""

from __future__ import annotations

import pytest

from app.providers import (
    Capability,
    Unsupported,
    all_providers,
    get_provider,
    provider_metadata,
)
from app.providers.base import BaseProvider, SessionRecord


def test_registry_contains_four_providers():
    ids = {p.id for p in all_providers()}
    assert ids == {"claude", "codex-cli", "gemini", "antigravity"}


def test_get_provider_known_and_unknown():
    assert get_provider("gemini") is not None
    assert get_provider("does-not-exist") is None


def test_provider_metadata_shape():
    meta = {m["id"]: m for m in provider_metadata()}
    assert set(meta["codex-cli"]["capabilities"]) >= {
        Capability.SESSIONS,
        Capability.SESSION_META,
        Capability.SCAN,
    }
    # Claude is alias-only: no flat-session browsing capability.
    assert Capability.SESSIONS not in meta["claude"]["capabilities"]
    assert Capability.ANALYTICS in meta["claude"]["capabilities"]


def test_unsupported_capability_raises():
    claude = get_provider("claude")
    assert not claude.supports(Capability.SESSIONS)
    with pytest.raises(Unsupported):
        claude.load_sessions()


def test_require_enforces_capability():
    antigravity = get_provider("antigravity")
    assert antigravity.supports(Capability.SESSIONS)
    antigravity.require(Capability.SESSIONS)  # no raise
    with pytest.raises(Unsupported):
        antigravity.require(Capability.SESSION_META)


def test_session_record_preserves_extra_fields():
    rec = SessionRecord(
        session_id="abc",
        project="proj",
        model="gpt-5",
        starred=True,
        custom_field="kept",
    )
    dumped = rec.model_dump()
    assert dumped["session_id"] == "abc"
    assert dumped["custom_field"] == "kept"


def test_base_provider_defaults_raise():
    class Empty(BaseProvider):
        id = "empty"
        capabilities = frozenset()

    p = Empty()
    for call in (
        p.load_sessions,
        p.scan_sessions,
        p.read_skills,
        p.read_settings,
        p.read_memory,
    ):
        with pytest.raises(Unsupported):
            call()
