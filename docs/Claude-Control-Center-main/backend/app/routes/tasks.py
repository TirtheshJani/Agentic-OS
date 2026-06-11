from flask import Blueprint, jsonify
from app.config import CLAUDE_DIR

bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")


@bp.get("")
def list_tasks():
    tasks_dir = CLAUDE_DIR / "tasks"
    if not tasks_dir.is_dir():
        return jsonify([])

    results = []
    for entry in sorted(tasks_dir.iterdir()):
        if not entry.is_dir():
            continue
        has_lock = (entry / ".lock").exists()
        hw_path = entry / ".highwatermark"
        highwatermark = None
        if hw_path.exists():
            try:
                highwatermark = hw_path.read_text().strip()
            except Exception:
                pass
        results.append({
            "uuid": entry.name,
            "hasLock": has_lock,
            "highwatermark": highwatermark,
        })
    return jsonify(results)
