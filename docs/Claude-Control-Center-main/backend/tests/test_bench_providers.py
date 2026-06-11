"""Regression coverage for the Model A/B Bench provider adapter."""

from __future__ import annotations

import sys
from types import SimpleNamespace

from app.services import bench_providers, codeburn_service


def test_non_claude_models_are_priced_with_longest_prefixes():
    assert codeburn_service.calculate_cost("gpt-4o", 1_000, 2_000) == 0.0225

    # Mini/lite variants must not be swallowed by their more expensive parent
    # prefixes.
    assert codeburn_service.calculate_cost("gpt-4o-mini", 1_000_000, 1_000_000) == 0.75
    assert codeburn_service.calculate_cost("gemini-2.5-flash-lite", 1_000_000, 1_000_000) == 0.5
    assert codeburn_service.calculate_cost("gemini-3-flash-preview", 1_000_000, 1_000_000) == 3.5


def test_openai_bench_invocation_reports_nonzero_cost(monkeypatch):
    monkeypatch.setattr(bench_providers, "OPENAI_API_KEY", "test-key")

    def fake_openai(model_id: str, prompt: str, max_tokens: int) -> dict:
        assert model_id == "gpt-4o"
        assert prompt == "What is 2+2?"
        assert max_tokens == bench_providers.DEFAULT_MAX_TOKENS
        return {"text": "4", "input_tokens": 1_000, "output_tokens": 2_000}

    monkeypatch.setitem(bench_providers._PROVIDERS, "openai", fake_openai)

    result = bench_providers.invoke("gpt-4o", "What is 2+2?")

    assert result["provider"] == "openai"
    assert result["error"] is None
    assert result["text"] == "4"
    assert result["cost_usd"] == 0.0225


def test_openai_adapter_uses_current_completion_limit_parameter(monkeypatch):
    captured: dict = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(message=SimpleNamespace(content="ok")),
                ],
                usage=SimpleNamespace(prompt_tokens=3, completion_tokens=4),
            )

    class FakeOpenAI:
        def __init__(self, api_key: str):
            captured["api_key"] = api_key
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))
    monkeypatch.setattr(bench_providers, "OPENAI_API_KEY", "test-key")

    out = bench_providers._invoke_openai("o3", "reason", 123)

    assert out == {"text": "ok", "input_tokens": 3, "output_tokens": 4}
    assert captured["api_key"] == "test-key"
    assert captured["model"] == "o3"
    assert captured["max_completion_tokens"] == 123
    assert "max_tokens" not in captured


def test_gemini_bench_invocation_reports_nonzero_cost(monkeypatch):
    monkeypatch.setattr(bench_providers, "GEMINI_API_KEY", "test-key")

    def fake_google(model_id: str, prompt: str, max_tokens: int) -> dict:
        assert model_id == "gemini-2.5-flash"
        return {"text": "ok", "input_tokens": 1_000_000, "output_tokens": 1_000_000}

    monkeypatch.setitem(bench_providers._PROVIDERS, "google", fake_google)

    result = bench_providers.invoke("gemini-2.5-flash", "ping")

    assert result["provider"] == "google"
    assert result["error"] is None
    assert result["cost_usd"] == 2.8
