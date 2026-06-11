"""Polymorphic CLI provider package (Phase 2)."""

from __future__ import annotations

from app.providers.base import (
    BaseProvider,
    Capability,
    CliProvider,
    SessionRecord,
    Unsupported,
)
from app.providers.registry import (
    all_providers,
    get_provider,
    provider_metadata,
)

__all__ = [
    "BaseProvider",
    "Capability",
    "CliProvider",
    "SessionRecord",
    "Unsupported",
    "all_providers",
    "get_provider",
    "provider_metadata",
]
