"""Multi-provider single-shot model invocation for the Model A/B Bench.

Every provider is reached through one uniform entry point, :func:`invoke`,
which takes ``(model_id, prompt)`` and always returns the same shape::

    {
        "provider": "anthropic" | "openai" | "google",
        "model": <model_id>,
        "text": <completion text>,
        "input_tokens": int,
        "output_tokens": int,
        "latency_ms": int,         # wall-clock around the call
        "cost_usd": float,         # priced via analytics_cost
        "error": str | None,       # set instead of raising
    }

Design notes:
  - Anthropic reuses the SDK call pattern from ``eval_judge_service`` (local
    ``from anthropic import Anthropic`` so a missing dependency fails at call
    time, not import time).
  - OpenAI / Gemini sit behind the same interface and are *only* invoked when
    their API key is configured (see :func:`available_providers`). Callers that
    fan out should consult ``available_providers`` first and skip unconfigured
    providers silently.
  - Nothing raises to the caller: any failure (no key, missing SDK, network,
    bad model id) is captured into the ``error`` field with empty text so one
    bad model can't sink a whole bench run.
"""
from __future__ import annotations

from time import perf_counter

from app.config import ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY
from app.services.analytics_cost import message_cost

# Single-shot completions are short; keep a sane cap so a runaway model can't
# blow the per-run budget.
DEFAULT_MAX_TOKENS = 1024


def available_providers() -> dict[str, bool]:
    """Map each provider to whether its API key is configured."""
    return {
        "anthropic": bool(ANTHROPIC_API_KEY),
        "openai": bool(OPENAI_API_KEY),
        "google": bool(GEMINI_API_KEY),
    }


def provider_for_model(model_id: str) -> str:
    """Route a model id to its provider by name prefix.

    Defaults to ``anthropic`` for unrecognised ids so a Claude-style id without
    an obvious prefix still resolves sensibly.
    """
    m = (model_id or "").lower()
    if "claude" in m:
        return "anthropic"
    if m.startswith(("gpt", "o1", "o3", "o4", "chatgpt")) or "gpt" in m:
        return "openai"
    if "gemini" in m or m.startswith("models/gemini"):
        return "google"
    return "anthropic"


# ---------------------------------------------------------------------------
# Per-provider calls — return {text, input_tokens, output_tokens}; never price
# or time (invoke() owns latency + cost). May raise; invoke() captures it.
# ---------------------------------------------------------------------------

def _invoke_anthropic(model_id: str, prompt: str, max_tokens: int) -> dict:
    from anthropic import Anthropic  # local import — fail at call time, not import

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model=model_id,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(
        getattr(b, "text", "") for b in resp.content if hasattr(b, "text")
    ).strip()
    usage = getattr(resp, "usage", None)
    return {
        "text": text,
        "input_tokens": getattr(usage, "input_tokens", 0) if usage else 0,
        "output_tokens": getattr(usage, "output_tokens", 0) if usage else 0,
    }


def _invoke_openai(model_id: str, prompt: str, max_tokens: int) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model=model_id,
        max_completion_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    text = (resp.choices[0].message.content or "").strip() if resp.choices else ""
    usage = getattr(resp, "usage", None)
    return {
        "text": text,
        "input_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
        "output_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
    }


def _invoke_google(model_id: str, prompt: str, max_tokens: int) -> dict:
    import google.generativeai as genai

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(model_id)
    resp = model.generate_content(
        prompt,
        generation_config={"max_output_tokens": max_tokens},
    )
    text = (getattr(resp, "text", "") or "").strip()
    usage = getattr(resp, "usage_metadata", None)
    return {
        "text": text,
        "input_tokens": getattr(usage, "prompt_token_count", 0) if usage else 0,
        "output_tokens": getattr(usage, "candidates_token_count", 0) if usage else 0,
    }


_PROVIDERS = {
    "anthropic": _invoke_anthropic,
    "openai": _invoke_openai,
    "google": _invoke_google,
}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def invoke(model_id: str, prompt: str, max_tokens: int = DEFAULT_MAX_TOKENS) -> dict:
    """Run *prompt* against *model_id*, returning the uniform result dict.

    Never raises: errors (missing key, missing SDK, network, bad model) land in
    the ``error`` field with empty text and zeroed usage.
    """
    provider = provider_for_model(model_id)
    result = {
        "provider": provider,
        "model": model_id,
        "text": "",
        "input_tokens": 0,
        "output_tokens": 0,
        "latency_ms": 0,
        "cost_usd": 0.0,
        "error": None,
    }

    if not available_providers().get(provider):
        result["error"] = f"{provider} API key not configured"
        return result

    fn = _PROVIDERS.get(provider)
    if fn is None:  # defensive — provider_for_model only emits known providers
        result["error"] = f"no adapter for provider '{provider}'"
        return result

    started = perf_counter()
    try:
        out = fn(model_id, prompt, max_tokens)
        result["text"] = out.get("text", "")
        result["input_tokens"] = out.get("input_tokens", 0) or 0
        result["output_tokens"] = out.get("output_tokens", 0) or 0
    except Exception as exc:  # noqa: BLE001 — one bad model must not sink the run
        result["error"] = f"{type(exc).__name__}: {exc}"
    result["latency_ms"] = int((perf_counter() - started) * 1000)

    if not result["error"]:
        result["cost_usd"] = round(
            message_cost(model_id, result["input_tokens"], result["output_tokens"], 0, 0),
            6,
        )
    return result
