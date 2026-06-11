import os
from pathlib import Path
from flask import Blueprint, jsonify, request
import orjson

from app.config import CLAUDE_DIR

bp = Blueprint("plugins", __name__, url_prefix="/api/plugins")

_PLUGINS_PATH = CLAUDE_DIR / "plugins" / "installed_plugins.json"
_SETTINGS_PATH = CLAUDE_DIR / "settings.json"


def _load_settings() -> dict:
    if _SETTINGS_PATH.exists():
        try:
            return orjson.loads(_SETTINGS_PATH.read_bytes())
        except Exception:
            pass
    return {}


def _save_settings(data: dict) -> None:
    tmp = _SETTINGS_PATH.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
    os.replace(tmp, _SETTINGS_PATH)


@bp.get("")
def list_plugins():
    if not _PLUGINS_PATH.exists():
        return jsonify([])
    try:
        raw = orjson.loads(_PLUGINS_PATH.read_bytes())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    settings = _load_settings()
    enabled_map: dict = settings.get("enabledPlugins", {})

    results = []
    for plugin_key, installs in raw.get("plugins", {}).items():
        if not installs:
            continue
        latest = installs[-1]
        # plugin_key format: "name@marketplace"
        parts = plugin_key.split("@", 1)
        name = parts[0]
        marketplace = parts[1] if len(parts) > 1 else ""
        is_enabled = enabled_map.get(plugin_key, True)
        install_path = latest.get("installPath")
        estimated_tokens = None
        if install_path:
            try:
                content = Path(install_path).read_text(encoding="utf-8", errors="ignore")
                estimated_tokens = len(content) // 4
            except Exception:
                pass

        results.append({
            "id": plugin_key,
            "name": name,
            "marketplace": marketplace,
            "scope": latest.get("scope", "user"),
            "version": latest.get("version", "unknown"),
            "installedAt": latest.get("installedAt"),
            "lastUpdated": latest.get("lastUpdated"),
            "installPath": install_path,
            "isEnabled": is_enabled,
            "estimatedContextTokens": estimated_tokens,
        })
    return jsonify(results)


@bp.put("/<path:plugin_id>/toggle")
def toggle_plugin(plugin_id: str):
    body = request.get_json(silent=True) or {}
    enabled = body.get("enabled")
    if enabled is None:
        return jsonify({"error": "enabled field required"}), 400
    try:
        settings = _load_settings()
        if "enabledPlugins" not in settings:
            settings["enabledPlugins"] = {}
        settings["enabledPlugins"][plugin_id] = bool(enabled)
        _save_settings(settings)
        return jsonify({"updated": True, "enabled": bool(enabled)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
