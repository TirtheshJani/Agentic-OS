from flask import Blueprint, jsonify, request
from pathlib import Path

from app.config import CLAUDE_DIR
from app.services.jsonl_parser import get_messages

bp = Blueprint("conversations", __name__, url_prefix="/api/sessions")


def _normalize_content(content):
    """Ensure content is always a list of content blocks."""
    if content is None:
        return []
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    if isinstance(content, list):
        return content
    return [{"type": "text", "text": str(content)}]


def _serialize_message(msg: dict) -> dict:
    inner = msg.get("message", {})
    content = _normalize_content(inner.get("content"))
    return {
        "uuid": msg.get("uuid"),
        "parentUuid": msg.get("parentUuid"),
        "type": msg.get("type"),
        "role": inner.get("role", msg.get("type")),
        "content": content,
        "timestamp": msg.get("timestamp"),
        "isSidechain": msg.get("isSidechain", False),
        "agentId": msg.get("agentId"),
        "isMeta": msg.get("isMeta", False),
        "sessionId": msg.get("sessionId"),
        "cwd": msg.get("cwd"),
        "gitBranch": msg.get("gitBranch"),
        "version": msg.get("version"),
        "slug": msg.get("slug"),
        "model": inner.get("model"),
        "usage": inner.get("usage"),
        "stopReason": inner.get("stop_reason"),
    }


@bp.get("/<session_id>/messages")
def get_session_messages(session_id: str):
    project_id = request.args.get("project_id")
    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    jsonl_path = CLAUDE_DIR / "projects" / project_id / f"{session_id}.jsonl"
    if not jsonl_path.exists():
        return jsonify({"error": "Session not found"}), 404

    messages = get_messages(jsonl_path)
    serialized = [_serialize_message(m) for m in messages]

    # Collect session metadata from first message
    session_meta = {}
    for m in messages:
        if m.get("cwd"):
            session_meta = {
                "cwd": m.get("cwd"),
                "gitBranch": m.get("gitBranch"),
                "version": m.get("version"),
                "sessionId": m.get("sessionId", session_id),
                "slug": m.get("slug"),
            }
            break

    # Find subagent IDs
    subagent_dir = CLAUDE_DIR / "projects" / project_id / session_id / "subagents"
    subagent_ids = []
    if subagent_dir.is_dir():
        for f in subagent_dir.glob("*.meta.json"):
            subagent_ids.append(f.stem.replace(".meta", ""))

    return jsonify({
        "session": session_meta,
        "messages": serialized,
        "subagentIds": subagent_ids,
    })


@bp.get("/<session_id>/subagents/<agent_id>")
def get_subagent(session_id: str, agent_id: str):
    project_id = request.args.get("project_id")
    if not project_id:
        return jsonify({"error": "project_id required"}), 400

    subagent_dir = CLAUDE_DIR / "projects" / project_id / session_id / "subagents"
    jsonl_path = subagent_dir / f"{agent_id}.jsonl"
    meta_path = subagent_dir / f"{agent_id}.meta.json"

    if not jsonl_path.exists():
        return jsonify({"error": "Subagent not found"}), 404

    import orjson
    meta = {}
    if meta_path.exists():
        try:
            meta = orjson.loads(meta_path.read_bytes())
        except Exception:
            pass

    messages = get_messages(jsonl_path)
    serialized = [_serialize_message(m) for m in messages]

    return jsonify({
        "meta": meta,
        "messages": serialized,
    })
