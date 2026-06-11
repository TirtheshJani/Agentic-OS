import os
from flask import Blueprint, jsonify, request
import orjson
import httpx

from app.config import CLAUDE_DIR, ANTHROPIC_API_KEY, MANAGED_AGENTS_BASE_URL

bp = Blueprint("settings", __name__, url_prefix="/api/settings")

_SETTINGS_PATH = CLAUDE_DIR / "settings.json"


@bp.get("")
def get_settings():
    if not _SETTINGS_PATH.exists():
        return jsonify({})
    try:
        data = orjson.loads(_SETTINGS_PATH.read_bytes())
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.get("/gateway-models")
def get_gateway_models():
    if not ANTHROPIC_API_KEY:
        return jsonify({"error": "API key not configured", "models": [], "baseUrl": MANAGED_AGENTS_BASE_URL})
    try:
        resp = httpx.get(
            f"{MANAGED_AGENTS_BASE_URL}/v1/models",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        return jsonify({"models": data.get("data", []), "baseUrl": MANAGED_AGENTS_BASE_URL})
    except Exception as e:
        return jsonify({"error": str(e), "models": [], "baseUrl": MANAGED_AGENTS_BASE_URL}), 502


@bp.put("")
def update_settings():
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"error": "Invalid JSON"}), 400
    try:
        current = {}
        if _SETTINGS_PATH.exists():
            current = orjson.loads(_SETTINGS_PATH.read_bytes())
        merged = {**current, **body}
        tmp = _SETTINGS_PATH.with_suffix(".tmp")
        tmp.write_bytes(orjson.dumps(merged, option=orjson.OPT_INDENT_2))
        os.replace(tmp, _SETTINGS_PATH)
        return jsonify({"updated": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
