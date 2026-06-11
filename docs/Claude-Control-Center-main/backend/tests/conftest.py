"""Shared pytest fixtures.

Goal: keep tests fast, isolated, and free of host-filesystem side effects.

Key fixtures:
- ``tmp_claude_dir`` / ``tmp_codex_dir`` — empty tmp directories that mimic
  ``~/.claude`` and ``~/.codex``. Use them to drop fake JSONL files into a
  test-owned tree. Both patch ``app.config`` so services pointing at the
  globals see the temporary path.
- ``fake_anthropic_client`` — a stand-in for ``anthropic_client`` that records
  calls and returns canned responses. Avoids any network use.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

import pytest


# ---------------------------------------------------------------------------
# Filesystem fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_claude_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Empty ~/.claude replacement with the standard subdir layout."""
    claude = tmp_path / "claude"
    (claude / "projects").mkdir(parents=True)
    (claude / "sessions").mkdir(parents=True)
    (claude / "memory").mkdir(parents=True)

    # Patch the config global so any service that imports CLAUDE_DIR sees it.
    monkeypatch.setattr("app.config.CLAUDE_DIR", str(claude), raising=False)
    return claude


@pytest.fixture
def tmp_codex_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Empty ~/.codex replacement."""
    codex = tmp_path / "codex"
    (codex / "sessions").mkdir(parents=True)
    monkeypatch.setattr("app.config.CODEX_DIR", str(codex), raising=False)
    return codex


@pytest.fixture
def write_jsonl() -> Callable[[Path, list[dict]], Path]:
    """Helper: dump a list of dicts to a JSONL file at the given path."""
    def _write(path: Path, rows: list[dict]) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            for row in rows:
                f.write(json.dumps(row) + "\n")
        return path
    return _write


# ---------------------------------------------------------------------------
# Fake providers
# ---------------------------------------------------------------------------

class FakeAnthropicClient:
    """Records messages.create calls and returns a scripted response.

    Tests can set ``client.next_response`` before each call, or supply a
    ``responder`` callable for per-call control.
    """

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.next_response: Any = {"content": [{"type": "text", "text": "ok"}]}
        self.responder: Callable[[dict[str, Any]], Any] | None = None

    # Mimics the shape of ``anthropic.Anthropic().messages.create``.
    @property
    def messages(self):
        return self

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.responder is not None:
            return self.responder(kwargs)
        return self.next_response


@pytest.fixture
def fake_anthropic_client() -> FakeAnthropicClient:
    return FakeAnthropicClient()
