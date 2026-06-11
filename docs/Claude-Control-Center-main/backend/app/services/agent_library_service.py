from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import orjson

_DATA_DIR = Path(__file__).parent.parent.parent / "data" / "agent_library"
_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _agent_path(agent_id: str) -> Path:
    return _DATA_DIR / f"{agent_id}.json"


def _read_agent(agent_id: str) -> dict[str, Any] | None:
    path = _agent_path(agent_id)
    if not path.exists():
        return None
    try:
        return orjson.loads(path.read_bytes())
    except Exception:
        return None


def _write_agent(agent: dict[str, Any]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _agent_path(agent["id"])
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(agent, option=orjson.OPT_INDENT_2))
    tmp.replace(path)


def _check_disk_state(agent: dict[str, Any]) -> dict[str, Any]:
    from app.config import CLAUDE_DIR
    slug = agent.get("slug", "")
    skill_path = CLAUDE_DIR / "skills" / slug / "SKILL.md"
    subagent_path = CLAUDE_DIR / "agents" / f"{slug}.md"
    return {
        **agent,
        "installed_skill": skill_path.exists(),
        "installed_subagent": subagent_path.exists(),
    }


def list_agents() -> list[dict[str, Any]]:
    if not _DATA_DIR.exists():
        return []
    agents = []
    with _lock:
        for path in sorted(_DATA_DIR.glob("*.json")):
            try:
                agent = orjson.loads(path.read_bytes())
                agents.append(_check_disk_state(agent))
            except Exception:
                continue
    agents.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    return agents


def get_agent(agent_id: str) -> dict[str, Any] | None:
    with _lock:
        agent = _read_agent(agent_id)
    if agent is None:
        return None
    return _check_disk_state(agent)


def create_agent(data: dict[str, Any]) -> dict[str, Any]:
    agent_id = str(uuid.uuid4())
    now = _now_iso()
    agent = {
        "id": agent_id,
        "name": data.get("name", "").strip(),
        "slug": _slugify(data.get("slug") or data.get("name", "")),
        "description": data.get("description", "").strip(),
        "system_prompt": data.get("system_prompt", "").strip(),
        "capabilities": data.get("capabilities", []),
        "cli_tools": data.get("cli_tools", []),
        "install_targets": data.get("install_targets", ["skill", "subagent"]),
        "source_session_ids": data.get("source_session_ids", []),
        "installed_skill": False,
        "installed_subagent": False,
        "created_at": now,
        "updated_at": now,
    }
    with _lock:
        _write_agent(agent)
    return _check_disk_state(agent)


def update_agent(agent_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    with _lock:
        agent = _read_agent(agent_id)
        if agent is None:
            return None
        for field in ("name", "description", "system_prompt"):
            if field in data:
                agent[field] = str(data[field]).strip()
        if "slug" in data:
            agent["slug"] = _slugify(data["slug"])
        elif "name" in data and not data.get("slug"):
            agent["slug"] = _slugify(data["name"])
        for field in ("capabilities", "cli_tools", "install_targets", "source_session_ids"):
            if field in data:
                agent[field] = data[field]
        agent["updated_at"] = _now_iso()
        _write_agent(agent)
    return _check_disk_state(agent)


def delete_agent(agent_id: str) -> bool:
    with _lock:
        path = _agent_path(agent_id)
        if not path.exists():
            return False
        path.unlink()
    return True


def _slugify(text: str) -> str:
    import re
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "agent"
