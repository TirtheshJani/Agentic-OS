from flask import Blueprint, jsonify, request
import orjson

from app.config import CLAUDE_DIR

bp = Blueprint("history", __name__, url_prefix="/api/history")


@bp.get("")
def list_history():
    history_path = CLAUDE_DIR / "history.jsonl"
    if not history_path.exists():
        return jsonify({"total": 0, "items": []})

    try:
        limit = int(request.args.get("limit", 100))
        offset = int(request.args.get("offset", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid parameter"}), 400
    project_filter = request.args.get("project")

    items = []
    with open(history_path, "rb") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                obj = orjson.loads(raw)
            except Exception:
                continue
            if project_filter and obj.get("project") != project_filter:
                continue
            items.append(obj)

    # Most recent first
    items.reverse()
    total = len(items)
    page = items[offset: offset + limit]
    return jsonify({"total": total, "items": page})
