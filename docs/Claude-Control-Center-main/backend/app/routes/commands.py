import re
from flask import Blueprint, jsonify, request
import frontmatter

from app.config import CLAUDE_DIR

bp = Blueprint("commands", __name__, url_prefix="/api/commands")

_COMMANDS_DIR = CLAUDE_DIR / "commands"


def _safe_name(name: str) -> str:
    return re.sub(r"[^\w\-]", "_", name.strip())


def _read_command(p) -> dict:
    try:
        post = frontmatter.load(str(p))
        return {
            "filename": p.name,
            "name": p.stem,
            "description": post.metadata.get("description", ""),
            "argumentHint": post.metadata.get("argument-hint", ""),
            "allowedTools": post.metadata.get("allowed-tools", []),
            "body": post.content,
        }
    except Exception:
        return {
            "filename": p.name,
            "name": p.stem,
            "description": "",
            "argumentHint": "",
            "allowedTools": [],
            "body": p.read_text(encoding="utf-8"),
        }


def _write_command(filename: str, data: dict) -> None:
    _COMMANDS_DIR.mkdir(parents=True, exist_ok=True)
    post = frontmatter.Post(
        content=data.get("body", ""),
        **{
            k: v for k, v in {
                "description": data.get("description", ""),
                "argument-hint": data.get("argumentHint", ""),
                "allowed-tools": data.get("allowedTools", []),
            }.items()
            if v
        },
    )
    (_COMMANDS_DIR / filename).write_text(
        frontmatter.dumps(post), encoding="utf-8"
    )


@bp.get("")
def list_commands():
    if not _COMMANDS_DIR.is_dir():
        return jsonify([])
    return jsonify([_read_command(p) for p in sorted(_COMMANDS_DIR.glob("*.md"))])


@bp.post("")
def create_command():
    body = request.get_json(silent=True) or {}
    name = _safe_name(body.get("name", ""))
    if not name:
        return jsonify({"error": "name required"}), 400
    filename = f"{name}.md"
    if (_COMMANDS_DIR / filename).exists():
        return jsonify({"error": f"Command '{name}' already exists"}), 409
    _write_command(filename, body)
    return jsonify({"filename": filename, "created": True}), 201


@bp.put("/<filename>")
def update_command(filename: str):
    path = _COMMANDS_DIR / filename
    if not path.exists():
        return jsonify({"error": "Not found"}), 404
    body = request.get_json(silent=True) or {}
    _write_command(filename, body)
    return jsonify({"filename": filename, "updated": True})


@bp.delete("/<filename>")
def delete_command(filename: str):
    path = _COMMANDS_DIR / filename
    if not path.exists():
        return jsonify({"error": "Not found"}), 404
    path.unlink()
    return jsonify({"deleted": True})
