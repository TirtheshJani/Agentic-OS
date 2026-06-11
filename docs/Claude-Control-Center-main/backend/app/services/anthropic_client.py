"""
Thin HTTP client for the Anthropic Managed Agents API.

Handles authentication headers, beta versioning, and rate limit tracking.
"""
from __future__ import annotations

import time
from collections import deque
from typing import Generator

import httpx

from app.config import ANTHROPIC_API_KEY, MANAGED_AGENTS_BASE_URL

_API_VERSION = "2023-06-01"
_BETA_HEADER = "managed-agents-2026-04-01"

# Simple sliding window rate limiter
_create_timestamps: deque[float] = deque()
_read_timestamps: deque[float] = deque()
_CREATE_LIMIT = 55  # stay under 60/min
_READ_LIMIT = 550   # stay under 600/min
_WINDOW = 60.0


class AnthropicAPIError(Exception):
    def __init__(self, status_code: int, message: str, error_type: str = "api_error"):
        self.status_code = status_code
        self.message = message
        self.error_type = error_type
        super().__init__(f"[{status_code}] {error_type}: {message}")


class RateLimitError(Exception):
    pass


def _check_rate_limit(timestamps: deque, limit: int) -> None:
    now = time.monotonic()
    while timestamps and timestamps[0] < now - _WINDOW:
        timestamps.popleft()
    if len(timestamps) >= limit:
        raise RateLimitError(f"Rate limit: {limit} requests per {_WINDOW}s exceeded")
    timestamps.append(now)


def _get_headers() -> dict[str, str]:
    return {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": _API_VERSION,
        "anthropic-beta": _BETA_HEADER,
        "content-type": "application/json",
    }


def _get_api_key() -> str:
    """Return current API key, re-reading from config in case it changed."""
    from app.config import ANTHROPIC_API_KEY
    return ANTHROPIC_API_KEY


def has_api_key() -> bool:
    return bool(_get_api_key())


def request(method: str, path: str, *, json: dict | None = None, is_create: bool = False) -> dict:
    """Make a JSON request to the Anthropic API."""
    if not has_api_key():
        raise AnthropicAPIError(401, "ANTHROPIC_API_KEY not configured", "auth_error")

    _check_rate_limit(
        _create_timestamps if is_create else _read_timestamps,
        _CREATE_LIMIT if is_create else _READ_LIMIT,
    )

    url = f"{MANAGED_AGENTS_BASE_URL}{path}"
    headers = _get_headers()

    with httpx.Client(timeout=30.0) as client:
        resp = client.request(method, url, headers=headers, json=json)

    if resp.status_code >= 400:
        try:
            body = resp.json()
            error = body.get("error", {})
            msg = error.get("message", resp.text)
            err_type = error.get("type", "api_error")
        except Exception:
            msg = resp.text
            err_type = "api_error"
        raise AnthropicAPIError(resp.status_code, msg, err_type)

    return resp.json()


def stream_sse(method: str, path: str, *, json: dict | None = None) -> Generator[dict, None, None]:
    """Stream SSE events from the Anthropic API. Yields parsed event dicts."""
    if not has_api_key():
        raise AnthropicAPIError(401, "ANTHROPIC_API_KEY not configured", "auth_error")

    _check_rate_limit(_create_timestamps, _CREATE_LIMIT)

    url = f"{MANAGED_AGENTS_BASE_URL}{path}"
    headers = _get_headers()
    headers["accept"] = "text/event-stream"

    with httpx.Client(timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0)) as client:
        with client.stream(method, url, headers=headers, json=json) as resp:
            if resp.status_code >= 400:
                body = resp.read()
                raise AnthropicAPIError(resp.status_code, body.decode("utf-8", errors="replace"))

            event_type = ""
            data_buf = ""
            for line in resp.iter_lines():
                if line.startswith("event:"):
                    event_type = line[6:].strip()
                elif line.startswith("data:"):
                    data_buf += line[5:].strip()
                elif line == "":
                    if event_type and data_buf:
                        import orjson
                        try:
                            parsed = orjson.loads(data_buf)
                        except Exception:
                            parsed = {"raw": data_buf}
                        yield {"event": event_type, "data": parsed}
                    event_type = ""
                    data_buf = ""
