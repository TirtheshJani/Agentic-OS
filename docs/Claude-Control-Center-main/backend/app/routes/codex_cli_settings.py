from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import codex_cli_settings_reader as reader

bp = Blueprint("codex_cli_settings", __name__, url_prefix="/api/codex-cli/settings")


@bp.get("/auth")
def get_auth():
    return jsonify(reader.read_auth())


@bp.get("/config")
def get_config():
    return jsonify(reader.read_config())


@bp.put("/config")
def update_config():
    body = request.get_json(force=True) or {}
    path = body.get("path", "").strip()
    trust_level = body.get("trust_level", "").strip()

    if not path:
        return jsonify({"error": "path required"}), 400
    if trust_level not in {"trusted", "untrusted"}:
        return jsonify({"error": "trust_level must be 'trusted' or 'untrusted'"}), 400

    try:
        reader.write_config(path, trust_level)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"updated": True})


@bp.get("/version")
def get_version():
    return jsonify(reader.read_version())


@bp.get("/models")
def get_models():
    return jsonify(reader.read_models())
