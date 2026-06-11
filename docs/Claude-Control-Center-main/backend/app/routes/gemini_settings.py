from __future__ import annotations

"""Read/write ~/.gemini/settings.json. Mirrors codex_cli_settings.py structure."""

import json
import os
from pathlib import Path

from flask import Blueprint, jsonify, request

_GEMINI_DIR = Path(os.getenv("GEMINI_DIR", str(Path.home() / ".gemini")))
_SETTINGS_PATH = _GEMINI_DIR / "settings.json"

bp = Blueprint("gemini_settings", __name__, url_prefix="/api/gemini/settings")


def _read() -> dict:
    if not _SETTINGS_PATH.exists():
        return {}
    try:
        return json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write(data: dict) -> None:
    _SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _SETTINGS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, _SETTINGS_PATH)


@bp.get("/")
def get_settings():
    return jsonify(_read())


@bp.put("/")
def update_settings():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "expected JSON object"}), 400
    current = _read()
    current.update(body)
    try:
        _write(current)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"updated": True})


@bp.get("/status")
def get_status():
    return jsonify({
        "gemini_dir_exists": _GEMINI_DIR.exists(),
        "settings_exists": _SETTINGS_PATH.exists(),
        "settings_path": str(_SETTINGS_PATH),
    })
