from __future__ import annotations

import os
import tomllib
from pathlib import Path

import orjson
import tomlkit

from app.config import CODEX_DIR

_AUTH = CODEX_DIR / "auth.json"
_CONFIG = CODEX_DIR / "config.toml"
_VERSION = CODEX_DIR / "version.json"
_MODELS = CODEX_DIR / "models_cache.json"


def read_auth() -> dict:
    if not _AUTH.exists():
        return {"present": False}
    try:
        raw = orjson.loads(_AUTH.read_bytes())
        tokens = raw.get("tokens") or {}
        return {
            "present": True,
            "auth_mode": raw.get("auth_mode"),
            "last_refresh": raw.get("last_refresh"),
            "has_id_token": bool(tokens.get("id_token")),
            "has_refresh_token": bool(tokens.get("refresh_token")),
            "account_id_present": raw.get("account_id") is not None or bool(tokens.get("account_id")),
        }
    except Exception:
        return {"present": True, "error": "parse_failed"}


def read_config() -> dict:
    if not _CONFIG.exists():
        return {"projects": []}
    try:
        with open(_CONFIG, "rb") as f:
            data = tomllib.load(f)
        projects = []
        for path, settings in (data.get("projects") or {}).items():
            projects.append({"path": path, "trust_level": settings.get("trust_level", "untrusted")})
        return {"projects": projects}
    except Exception:
        return {"projects": [], "error": "parse_failed"}


def write_config(path: str, trust_level: str) -> None:
    if trust_level not in {"trusted", "untrusted"}:
        raise ValueError(f"Invalid trust_level: {trust_level}")

    if _CONFIG.exists():
        with open(_CONFIG) as f:
            doc = tomlkit.load(f)
    else:
        doc = tomlkit.document()

    if "projects" not in doc:
        doc.add("projects", tomlkit.table())

    projects_table = doc["projects"]
    if path not in projects_table:
        projects_table.add(tomlkit.comment(""))
        entry = tomlkit.table()
        entry.add("trust_level", trust_level)
        projects_table.add(path, entry)
    else:
        projects_table[path]["trust_level"] = trust_level

    tmp = Path(str(_CONFIG) + ".tmp")
    tmp.write_text(tomlkit.dumps(doc))
    os.replace(tmp, _CONFIG)


def read_version() -> dict:
    if not _VERSION.exists():
        return {}
    try:
        return orjson.loads(_VERSION.read_bytes())
    except Exception:
        return {"error": "parse_failed"}


def read_models() -> dict:
    if not _MODELS.exists():
        return {"fetched_at": None, "models": []}
    try:
        raw = orjson.loads(_MODELS.read_bytes())
        models = []
        for m in raw.get("models") or []:
            base = m.get("base_instructions") or {}
            models.append({
                "id": m.get("slug") or m.get("id") or "",
                "display_name": m.get("display_name") or "",
                "context_window": m.get("context_window"),
                "has_base_instructions": bool(base.get("text") or base),
            })
        return {"fetched_at": raw.get("fetched_at"), "models": models}
    except Exception:
        return {"fetched_at": None, "models": [], "error": "parse_failed"}
