"""Provider registry — the single source of truth for which CLI stacks exist.

The unified routes and the unified background scanner both iterate this
registry. Adding a fifth provider is: write ``app/providers/<name>.py`` and add
one entry to ``_PROVIDERS`` below.
"""

from __future__ import annotations

from app.providers.antigravity import AntigravityProvider
from app.providers.base import BaseProvider
from app.providers.claude import ClaudeProvider
from app.providers.codex_cli import CodexCliProvider
from app.providers.gemini import GeminiProvider

_PROVIDERS: dict[str, BaseProvider] = {
    p.id: p
    for p in (
        ClaudeProvider(),
        CodexCliProvider(),
        GeminiProvider(),
        AntigravityProvider(),
    )
}


def get_provider(provider_id: str) -> BaseProvider | None:
    """Return the provider for *provider_id*, or ``None`` if unknown."""
    return _PROVIDERS.get(provider_id)


def all_providers() -> list[BaseProvider]:
    """Return every registered provider."""
    return list(_PROVIDERS.values())


def provider_metadata() -> list[dict]:
    """Serializable descriptors for the ``/api/cli/providers`` listing."""
    return [p.to_metadata() for p in _PROVIDERS.values()]
