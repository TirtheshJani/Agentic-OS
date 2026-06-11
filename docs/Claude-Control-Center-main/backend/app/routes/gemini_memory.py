from __future__ import annotations

"""Read/write memory entries for Gemini CLI. Includes GEMINI.md editor and Claude memory bridge."""

import os
from pathlib import Path

from flask import Blueprint, jsonify, request

from app.config import CLAUDE_DIR

_GEMINI_DIR = Path(os.getenv("GEMINI_DIR", str(Path.home() / ".gemini")))
_GEMINI_MD = _GEMINI_DIR / "GEMINI.md"

bp = Blueprint("gemini_memory", __name__, url_prefix="/api/gemini/memory")

_MEMORY_FILENAMES = ["memory.md", "MEMORY.md", "memory.json", "context.md"]


def _read_memory_file() -> str | None:
    for name in _MEMORY_FILENAMES:
        p = _GEMINI_DIR / name
        if p.exists():
            try:
                return p.read_text(encoding="utf-8")
            except Exception:
                continue
    return None


def _parse_memory_entries(content: str) -> list[dict]:
    """Parse markdown memory into simple entry list."""
    entries: list[dict] = []
    if not content:
        return entries
    # Split by lines, treat each non-empty line as an entry
    for i, line in enumerate(content.splitlines()):
        line = line.strip()
        if line and not line.startswith("#"):
            entries.append({
                "id": i,
                "text": line,
                "source": "gemini-memory",
            })
    return entries


@bp.get("/entries")
def get_entries():
    page = max(1, int(request.args.get("page", 1)))
    limit = max(1, min(int(request.args.get("limit", 50)), 200))
    search = request.args.get("search", "").strip().lower()

    content = _read_memory_file()
    if content is None:
        return jsonify({"total": 0, "page": page, "limit": limit, "items": [], "available": False})

    entries = _parse_memory_entries(content)
    if search:
        entries = [e for e in entries if search in e["text"].lower()]

    total = len(entries)
    offset = (page - 1) * limit
    items = entries[offset:offset + limit]

    return jsonify({
        "total": total,
        "page": page,
        "limit": limit,
        "items": items,
        "available": True,
    })


@bp.get("/status")
def get_status():
    memory_file = None
    for name in _MEMORY_FILENAMES:
        p = _GEMINI_DIR / name
        if p.exists():
            memory_file = str(p)
            break
    return jsonify({
        "gemini_dir_exists": _GEMINI_DIR.exists(),
        "memory_file": memory_file,
        "available": memory_file is not None,
    })


@bp.get("/gemini-md")
def get_gemini_md():
    exists = _GEMINI_MD.exists()
    content = ""
    if exists:
        try:
            content = _GEMINI_MD.read_text(encoding="utf-8")
        except Exception:
            content = ""
    return jsonify({"content": content, "exists": exists, "path": str(_GEMINI_MD)})


@bp.put("/gemini-md")
def update_gemini_md():
    body = request.get_json(silent=True) or {}
    content = body.get("content", "")
    if not isinstance(content, str):
        return jsonify({"error": "content must be a string"}), 400
    try:
        _GEMINI_MD.parent.mkdir(parents=True, exist_ok=True)
        tmp = _GEMINI_MD.with_suffix(".tmp")
        tmp.write_text(content, encoding="utf-8")
        os.replace(tmp, _GEMINI_MD)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"saved": True, "path": str(_GEMINI_MD)})


@bp.get("/claude-memories")
def get_claude_memories():
    results: list[dict] = []
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.is_dir():
        return jsonify({"items": results})

    for proj_dir in sorted(projects_dir.iterdir()):
        if not proj_dir.is_dir():
            continue
        memory_dir = proj_dir / "memory"
        if not memory_dir.is_dir():
            continue
        project_name = proj_dir.name
        for md_file in sorted(memory_dir.glob("*.md")):
            if md_file.name.upper() == "MEMORY.MD":
                continue
            try:
                body = md_file.read_text(encoding="utf-8")
            except Exception:
                continue
            # Simple frontmatter: strip --- block if present
            name = md_file.stem
            description = ""
            if body.startswith("---"):
                end = body.find("---", 3)
                if end != -1:
                    fm = body[3:end]
                    body = body[end + 3:].lstrip()
                    for line in fm.splitlines():
                        if line.startswith("name:"):
                            name = line[5:].strip().strip('"')
                        elif line.startswith("description:"):
                            description = line[12:].strip().strip('"')
            results.append({
                "project": project_name,
                "filename": md_file.name,
                "name": name,
                "description": description,
                "body": body,
            })

    return jsonify({"items": results})
