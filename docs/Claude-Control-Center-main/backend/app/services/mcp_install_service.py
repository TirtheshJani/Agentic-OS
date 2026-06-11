from __future__ import annotations

"""Install/uninstall the CCC MCP memory server in Claude Code, Codex, and Gemini CLI configs."""

import json
import os
from pathlib import Path
from typing import Any

import orjson

from app.config import CLAUDE_DIR, PORT

_SENTINEL_KEY = "_ccc_managed"
_SENTINEL_VALUE = True

# Gemini settings path
_GEMINI_DIR = Path(os.getenv("GEMINI_DIR", str(Path.home() / ".gemini")))
_CODEX_DIR = Path(os.getenv("CODEX_DIR", str(Path.home() / ".codex")))


def _find_server_path() -> str:
    """Locate the mcp-memory-server dist/index.js."""
    env_path = os.getenv("MCP_MEMORY_SERVER_PATH", "")
    if env_path and Path(env_path).exists():
        return env_path

    # Search relative to this file's project root
    project_root = Path(__file__).parent.parent.parent.parent
    candidates = [
        project_root / "mcp-memory-server" / "dist" / "index.js",
        project_root.parent / "mcp-memory-server" / "dist" / "index.js",
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return ""


def _ccc_base_url() -> str:
    return f"http://127.0.0.1:{PORT}"


# ---------------------------------------------------------------------------
# Claude Code: ~/.claude/.claude.json
# ---------------------------------------------------------------------------

def _claude_config_path() -> Path:
    return CLAUDE_DIR / ".claude.json"


def _read_claude_config() -> dict:
    p = _claude_config_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_claude_config(data: dict) -> None:
    p = _claude_config_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, p)


def _install_claude(path: str) -> dict:
    data = _read_claude_config()
    mcp = data.setdefault("mcpServers", {})
    existing = mcp.get("memory", {})
    if existing and not existing.get(_SENTINEL_KEY):
        return {"installed": False, "reason": "existing non-managed 'memory' entry in Claude config"}
    mcp["memory"] = {
        _SENTINEL_KEY: _SENTINEL_VALUE,
        "command": "node",
        "args": [path],
        "env": {"CCC_BASE_URL": _ccc_base_url()},
    }
    _write_claude_config(data)
    return {"installed": True, "agent": "claude", "path": path}


def _uninstall_claude() -> dict:
    data = _read_claude_config()
    mcp = data.get("mcpServers", {})
    entry = mcp.get("memory", {})
    if not entry:
        return {"uninstalled": False, "reason": "not found"}
    if not entry.get(_SENTINEL_KEY):
        return {"uninstalled": False, "reason": "not managed by CCC"}
    mcp.pop("memory")
    data["mcpServers"] = mcp
    _write_claude_config(data)
    return {"uninstalled": True, "agent": "claude"}


def _status_claude() -> dict:
    mcp = _read_claude_config().get("mcpServers", {})
    entry = mcp.get("memory", {})
    installed = bool(entry and entry.get(_SENTINEL_KEY))
    return {
        "installed": installed,
        "path": entry.get("args", [None])[0] if installed else None,
    }


# ---------------------------------------------------------------------------
# Codex: ~/.codex/config.toml via tomlkit
# ---------------------------------------------------------------------------

def _codex_config_path() -> Path:
    return _CODEX_DIR / "config.toml"


def _install_codex(path: str) -> dict:
    try:
        import tomlkit  # type: ignore
    except ImportError:
        return {"installed": False, "reason": "tomlkit not installed"}
    cfg_path = _codex_config_path()
    if cfg_path.exists():
        doc = tomlkit.loads(cfg_path.read_text(encoding="utf-8"))
    else:
        doc = tomlkit.document()
        cfg_path.parent.mkdir(parents=True, exist_ok=True)

    mcp = doc.setdefault("mcp_servers", tomlkit.table())
    existing = mcp.get("memory", {})
    if existing and not existing.get(_SENTINEL_KEY):
        return {"installed": False, "reason": "existing non-managed 'memory' entry in Codex config"}

    mem_table = tomlkit.table()
    mem_table.add(_SENTINEL_KEY, True)
    mem_table.add("command", "node")
    mem_table.add("args", [path])
    mem_table.add("env", {"CCC_BASE_URL": _ccc_base_url()})
    mcp["memory"] = mem_table

    tmp = cfg_path.with_suffix(".tmp")
    tmp.write_text(tomlkit.dumps(doc), encoding="utf-8")
    os.replace(tmp, cfg_path)
    return {"installed": True, "agent": "codex", "path": path}


def _uninstall_codex() -> dict:
    try:
        import tomlkit  # type: ignore
    except ImportError:
        return {"uninstalled": False, "reason": "tomlkit not installed"}
    cfg_path = _codex_config_path()
    if not cfg_path.exists():
        return {"uninstalled": False, "reason": "not found"}
    doc = tomlkit.loads(cfg_path.read_text(encoding="utf-8"))
    mcp = doc.get("mcp_servers", {})
    entry = mcp.get("memory", {})
    if not entry:
        return {"uninstalled": False, "reason": "not found"}
    if not entry.get(_SENTINEL_KEY):
        return {"uninstalled": False, "reason": "not managed by CCC"}
    del mcp["memory"]
    tmp = cfg_path.with_suffix(".tmp")
    tmp.write_text(tomlkit.dumps(doc), encoding="utf-8")
    os.replace(tmp, cfg_path)
    return {"uninstalled": True, "agent": "codex"}


def _status_codex() -> dict:
    try:
        import tomlkit  # type: ignore
    except ImportError:
        return {"installed": False, "path": None}
    cfg_path = _codex_config_path()
    if not cfg_path.exists():
        return {"installed": False, "path": None}
    try:
        doc = tomlkit.loads(cfg_path.read_text(encoding="utf-8"))
        entry = doc.get("mcp_servers", {}).get("memory", {})
        installed = bool(entry and entry.get(_SENTINEL_KEY))
        args = entry.get("args", [])
        return {"installed": installed, "path": args[0] if installed and args else None}
    except Exception:
        return {"installed": False, "path": None}


# ---------------------------------------------------------------------------
# Gemini: ~/.gemini/settings.json
# ---------------------------------------------------------------------------

def _gemini_settings_path() -> Path:
    return _GEMINI_DIR / "settings.json"


def _read_gemini_settings() -> dict:
    p = _gemini_settings_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_gemini_settings(data: dict) -> None:
    p = _gemini_settings_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, p)


def _install_gemini(path: str) -> dict:
    data = _read_gemini_settings()
    mcp = data.setdefault("mcpServers", {})
    existing = mcp.get("memory", {})
    if existing and not existing.get(_SENTINEL_KEY):
        return {"installed": False, "reason": "existing non-managed 'memory' entry in Gemini config"}
    mcp["memory"] = {
        _SENTINEL_KEY: _SENTINEL_VALUE,
        "command": "node",
        "args": [path],
        "env": {"CCC_BASE_URL": _ccc_base_url()},
    }
    _write_gemini_settings(data)
    return {"installed": True, "agent": "gemini", "path": path}


def _uninstall_gemini() -> dict:
    data = _read_gemini_settings()
    mcp = data.get("mcpServers", {})
    entry = mcp.get("memory", {})
    if not entry:
        return {"uninstalled": False, "reason": "not found"}
    if not entry.get(_SENTINEL_KEY):
        return {"uninstalled": False, "reason": "not managed by CCC"}
    mcp.pop("memory")
    data["mcpServers"] = mcp
    _write_gemini_settings(data)
    return {"uninstalled": True, "agent": "gemini"}


def _status_gemini() -> dict:
    mcp = _read_gemini_settings().get("mcpServers", {})
    entry = mcp.get("memory", {})
    installed = bool(entry and entry.get(_SENTINEL_KEY))
    return {
        "installed": installed,
        "path": entry.get("args", [None])[0] if installed else None,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_AGENTS = {"claude", "codex", "gemini"}


def install(agent: str) -> dict:
    if agent not in _AGENTS:
        raise ValueError(f"Unknown agent '{agent}'. Must be one of: {', '.join(_AGENTS)}")
    path = _find_server_path()
    if not path:
        return {"installed": False, "reason": "MCP memory server not found. Set MCP_MEMORY_SERVER_PATH env var."}
    if agent == "claude":
        return _install_claude(path)
    elif agent == "codex":
        return _install_codex(path)
    else:
        return _install_gemini(path)


def uninstall(agent: str) -> dict:
    if agent not in _AGENTS:
        raise ValueError(f"Unknown agent '{agent}'.")
    if agent == "claude":
        return _uninstall_claude()
    elif agent == "codex":
        return _uninstall_codex()
    else:
        return _uninstall_gemini()


def status() -> dict:
    return {
        "claude": _status_claude(),
        "codex": _status_codex(),
        "gemini": _status_gemini(),
        "server_path": _find_server_path() or None,
    }
