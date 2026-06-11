"""
Managed Agents service layer.

Provides CRUD operations for agents, environments, and sessions via the
Anthropic Managed Agents API. Caches metadata locally for offline browsing.
"""
from __future__ import annotations

from pathlib import Path
from typing import Generator

import orjson

from app.services import anthropic_client

_CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "managed_agents"


def _ensure_cache_dir() -> None:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_write(kind: str, item_id: str, data: dict) -> None:
    _ensure_cache_dir()
    path = _CACHE_DIR / kind
    path.mkdir(exist_ok=True)
    (path / f"{item_id}.json").write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))


def _cache_read(kind: str, item_id: str) -> dict | None:
    path = _CACHE_DIR / kind / f"{item_id}.json"
    if path.exists():
        try:
            return orjson.loads(path.read_bytes())
        except Exception:
            return None
    return None


def _cache_list(kind: str) -> list[dict]:
    path = _CACHE_DIR / kind
    if not path.exists():
        return []
    items = []
    for f in sorted(path.glob("*.json")):
        try:
            items.append(orjson.loads(f.read_bytes()))
        except Exception:
            continue
    return items


def _cache_delete(kind: str, item_id: str) -> None:
    path = _CACHE_DIR / kind / f"{item_id}.json"
    if path.exists():
        path.unlink()


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------

def list_agents() -> list[dict]:
    try:
        result = anthropic_client.request("GET", "/v1/agents")
        agents = result.get("data", result if isinstance(result, list) else [])
        for a in agents:
            if a.get("id"):
                _cache_write("agents", a["id"], a)
        return agents
    except anthropic_client.AnthropicAPIError:
        return _cache_list("agents")


def get_agent(agent_id: str) -> dict:
    try:
        result = anthropic_client.request("GET", f"/v1/agents/{agent_id}")
        _cache_write("agents", agent_id, result)
        return result
    except anthropic_client.AnthropicAPIError as e:
        cached = _cache_read("agents", agent_id)
        if cached:
            return cached
        raise e


def create_agent(data: dict) -> dict:
    result = anthropic_client.request("POST", "/v1/agents", json=data, is_create=True)
    if result.get("id"):
        _cache_write("agents", result["id"], result)
    return result


def update_agent(agent_id: str, data: dict) -> dict:
    result = anthropic_client.request("PUT", f"/v1/agents/{agent_id}", json=data)
    _cache_write("agents", agent_id, result)
    return result


def delete_agent(agent_id: str) -> None:
    anthropic_client.request("DELETE", f"/v1/agents/{agent_id}")
    _cache_delete("agents", agent_id)


# ---------------------------------------------------------------------------
# Environments
# ---------------------------------------------------------------------------

def list_environments() -> list[dict]:
    try:
        result = anthropic_client.request("GET", "/v1/environments")
        envs = result.get("data", result if isinstance(result, list) else [])
        for e in envs:
            if e.get("id"):
                _cache_write("environments", e["id"], e)
        return envs
    except anthropic_client.AnthropicAPIError:
        return _cache_list("environments")


def get_environment(env_id: str) -> dict:
    try:
        result = anthropic_client.request("GET", f"/v1/environments/{env_id}")
        _cache_write("environments", env_id, result)
        return result
    except anthropic_client.AnthropicAPIError as e:
        cached = _cache_read("environments", env_id)
        if cached:
            return cached
        raise e


def create_environment(data: dict) -> dict:
    result = anthropic_client.request("POST", "/v1/environments", json=data, is_create=True)
    if result.get("id"):
        _cache_write("environments", result["id"], result)
    return result


def update_environment(env_id: str, data: dict) -> dict:
    result = anthropic_client.request("PUT", f"/v1/environments/{env_id}", json=data)
    _cache_write("environments", env_id, result)
    return result


def delete_environment(env_id: str) -> None:
    anthropic_client.request("DELETE", f"/v1/environments/{env_id}")
    _cache_delete("environments", env_id)


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def list_sessions(agent_id: str | None = None) -> list[dict]:
    try:
        path = "/v1/sessions"
        if agent_id:
            path += f"?agent_id={agent_id}"
        result = anthropic_client.request("GET", path)
        sessions = result.get("data", result if isinstance(result, list) else [])
        for s in sessions:
            if s.get("id"):
                _cache_write("sessions", s["id"], s)
        return sessions
    except anthropic_client.AnthropicAPIError:
        cached = _cache_list("sessions")
        if agent_id:
            cached = [s for s in cached if s.get("agent_id") == agent_id]
        return cached


def get_session(session_id: str) -> dict:
    try:
        result = anthropic_client.request("GET", f"/v1/sessions/{session_id}")
        _cache_write("sessions", session_id, result)
        return result
    except anthropic_client.AnthropicAPIError as e:
        cached = _cache_read("sessions", session_id)
        if cached:
            return cached
        raise e


def create_session(data: dict) -> dict:
    result = anthropic_client.request("POST", "/v1/sessions", json=data, is_create=True)
    if result.get("id"):
        _cache_write("sessions", result["id"], result)
    return result


def send_message(session_id: str, message: str) -> dict:
    return anthropic_client.request(
        "POST",
        f"/v1/sessions/{session_id}/messages",
        json={"content": message},
        is_create=True,
    )


def stream_events(session_id: str) -> Generator[dict, None, None]:
    """Stream SSE events from a managed agent session."""
    yield from anthropic_client.stream_sse(
        "GET",
        f"/v1/sessions/{session_id}/events",
    )
