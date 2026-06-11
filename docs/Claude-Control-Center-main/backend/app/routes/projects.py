import shutil
from collections import defaultdict
from flask import Blueprint, jsonify
from pathlib import Path

from app.config import CLAUDE_DIR
from app.services.project_decoder import decode_project_dir, display_name
from app.services.jsonl_parser import index_session
from app.services import analytics_service

bp = Blueprint("projects", __name__, url_prefix="/api/projects")


def _get_projects_dir() -> Path:
    return CLAUDE_DIR / "projects"


@bp.get("")
def list_projects():
    projects_dir = _get_projects_dir()
    if not projects_dir.is_dir():
        return jsonify([])

    results = []
    for entry in sorted(projects_dir.iterdir()):
        if not entry.is_dir():
            continue
        sessions = list(entry.glob("*.jsonl"))
        if not sessions:
            continue

        last_activity = None
        for s in sessions:
            idx = index_session(s)
            ts = idx.get("lastMessageAt")
            if ts and (last_activity is None or ts > last_activity):
                last_activity = ts

        memory_dir = entry / "memory"
        has_memory = memory_dir.is_dir() and any(
            f for f in memory_dir.glob("*.md") if f.name != "MEMORY.md"
        )

        results.append({
            "id": entry.name,
            "displayName": display_name(entry.name),
            "fullPath": decode_project_dir(entry.name),
            "sessionCount": len(sessions),
            "lastActivity": last_activity,
            "hasMemory": has_memory,
        })

    results.sort(key=lambda x: x.get("lastActivity") or "", reverse=True)

    # Enrich with quality data from analytics cache (degrades gracefully if cache is empty)
    summaries = analytics_service.load()
    proj_scores: dict[str, list[int]] = defaultdict(list)
    for s in summaries:
        proj_scores[s.get("project_dir", "")].append(s.get("quality_score", 0))

    for r in results:
        scores = proj_scores.get(r["id"], [])
        avg = round(sum(scores) / len(scores)) if scores else None
        r["avgQualityScore"] = avg
        r["qualityTier"] = (
            "high" if avg is not None and avg >= 67 else
            "medium" if avg is not None and avg >= 33 else
            "low" if avg is not None else None
        )

    return jsonify(results)


@bp.delete("/<project_id>/purge")
def purge_project(project_id: str):
    projects_dir = _get_projects_dir()
    target = projects_dir / project_id
    try:
        target.resolve().relative_to(projects_dir.resolve())
    except ValueError:
        return jsonify({"error": "Invalid project id"}), 400
    if not target.is_dir():
        return jsonify({"error": "Project not found"}), 404
    shutil.rmtree(target)
    return jsonify({"purged": True, "id": project_id})


@bp.get("/<project_id>/sessions")
def list_sessions(project_id: str):
    project_dir = _get_projects_dir() / project_id
    if not project_dir.is_dir():
        return jsonify({"error": "Project not found"}), 404

    sessions = []
    for jsonl in sorted(project_dir.glob("*.jsonl")):
        idx = index_session(jsonl)
        sessions.append({
            "sessionId": jsonl.stem,
            **idx,
        })

    sessions.sort(key=lambda x: x.get("lastMessageAt") or "", reverse=True)
    return jsonify(sessions)
