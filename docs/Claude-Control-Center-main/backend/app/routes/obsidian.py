from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import obsidian_vault_service, obsidian_sync_service

bp = Blueprint("obsidian", __name__, url_prefix="/api/obsidian")


# ---------------------------------------------------------------------------
# Vault management
# ---------------------------------------------------------------------------

@bp.get("/vaults")
def list_vaults():
    return jsonify(obsidian_vault_service.list_vaults())


@bp.post("/vaults")
def add_vault():
    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()
    path = body.get("path", "").strip()
    if not name or not path:
        return jsonify({"error": "name and path required"}), 400
    try:
        vault = obsidian_vault_service.add_vault(name, path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(vault), 201


@bp.delete("/vaults/<vault_id>")
def remove_vault(vault_id: str):
    removed = obsidian_vault_service.remove_vault(vault_id)
    if not removed:
        return jsonify({"error": "Vault not found"}), 404
    return jsonify({"removed": True})


@bp.put("/vaults/<vault_id>")
def update_vault(vault_id: str):
    body = request.get_json(silent=True) or {}
    try:
        vault = obsidian_vault_service.update_vault(vault_id, **body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify(vault)


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

@bp.get("/vaults/<vault_id>/notes")
def list_notes(vault_id: str):
    folder = request.args.get("folder", "")
    try:
        notes = obsidian_vault_service.list_notes(vault_id, folder)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify(notes)


@bp.get("/vaults/<vault_id>/notes/<path:relative_path>")
def read_note(vault_id: str, relative_path: str):
    try:
        note = obsidian_vault_service.read_note(vault_id, relative_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except FileNotFoundError:
        return jsonify({"error": "Note not found"}), 404
    return jsonify(note)


@bp.post("/vaults/<vault_id>/notes/<path:relative_path>")
def write_note(vault_id: str, relative_path: str):
    body = request.get_json(silent=True) or {}
    content = body.get("content", "")
    try:
        result = obsidian_vault_service.write_note(vault_id, relative_path, content)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(result), 201


@bp.get("/vaults/<vault_id>/search")
def search_notes(vault_id: str):
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "q parameter required"}), 400
    try:
        results = obsidian_vault_service.search_notes(vault_id, query)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify(results)


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

@bp.post("/vaults/<vault_id>/sync/ingest")
def trigger_ingest(vault_id: str):
    """Trigger immediate ingest scan for this vault."""
    try:
        result = obsidian_sync_service.trigger_vault_ingest(vault_id)
    except ValueError as exc:
        status = 400 if "disabled" in str(exc).lower() else 404
        return jsonify({"error": str(exc)}), status
    return jsonify(result)


@bp.post("/vaults/<vault_id>/sync/push")
def push_to_vault(vault_id: str):
    body = request.get_json(silent=True) or {}
    title = body.get("title", "").strip()
    content = body.get("content", "")
    folder = body.get("folder", "CCC-Research")
    tags = body.get("tags")
    if not title:
        return jsonify({"error": "title required"}), 400
    try:
        result = obsidian_sync_service.push_to_vault(vault_id, title, content, folder, tags)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify(result), 201


@bp.get("/vaults/<vault_id>/sync/status")
def sync_status(vault_id: str):
    try:
        return jsonify(obsidian_sync_service.vault_sync_status(vault_id))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
