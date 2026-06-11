"""Project-scoped memory file CRUD. Cross-agent RAG memory lives in memory_rag.py."""
from flask import Blueprint, jsonify, request

from app.services import memory_service

bp = Blueprint("memory", __name__, url_prefix="/api/projects")


@bp.get("/<project_id>/memory")
def list_memory(project_id: str):
    try:
        files = memory_service.list_memory_files(project_id)
        return jsonify(files)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@bp.get("/<project_id>/memory/<filename>")
def get_memory(project_id: str, filename: str):
    try:
        data = memory_service.get_memory_file(project_id, filename)
        return jsonify(data)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@bp.post("/<project_id>/memory")
def create_memory(project_id: str):
    body = request.get_json(silent=True) or {}
    filename = body.get("filename", "")
    if not filename:
        return jsonify({"error": "filename required"}), 400
    meta = {
        "name": body.get("name", ""),
        "description": body.get("description", ""),
        "type": body.get("type", "project"),
    }
    try:
        saved = memory_service.write_memory_file(project_id, filename, meta, body.get("body", ""))
        return jsonify({"filename": saved, "created": True}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@bp.put("/<project_id>/memory/<filename>")
def update_memory(project_id: str, filename: str):
    body = request.get_json(silent=True) or {}
    try:
        existing = memory_service.get_memory_file(project_id, filename)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    meta = {
        "name": body.get("name", existing["frontmatter"].get("name", "")),
        "description": body.get("description", existing["frontmatter"].get("description", "")),
        "type": body.get("type", existing["frontmatter"].get("type", "")),
    }
    content = body.get("body", existing["body"])
    try:
        saved = memory_service.write_memory_file(project_id, filename, meta, content)
        return jsonify({"filename": saved, "updated": True})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@bp.delete("/<project_id>/memory/<filename>")
def delete_memory(project_id: str, filename: str):
    try:
        memory_service.delete_memory_file(project_id, filename)
        return jsonify({"deleted": True})
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
