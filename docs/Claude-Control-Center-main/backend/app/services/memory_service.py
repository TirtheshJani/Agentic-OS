"""
Memory file CRUD with atomic writes and automatic MEMORY.md index rebuilding.
"""
from __future__ import annotations

import os
from pathlib import Path

import frontmatter

from app.config import CLAUDE_DIR


def _resolve_memory_dir(project_id: str) -> Path:
    memory_dir = (CLAUDE_DIR / "projects" / project_id / "memory").resolve()
    # Ensure it's inside CLAUDE_DIR
    if not str(memory_dir).startswith(str(CLAUDE_DIR.resolve())):
        raise ValueError(f"Path traversal detected: {project_id}")
    memory_dir.mkdir(parents=True, exist_ok=True)
    return memory_dir


def _safe_filename(filename: str) -> str:
    """Strip any path separators to prevent traversal via filename."""
    name = Path(filename).name
    if not name.endswith(".md"):
        name += ".md"
    return name


def list_memory_files(project_id: str) -> list[dict]:
    memory_dir = _resolve_memory_dir(project_id)
    results = []
    for p in sorted(memory_dir.glob("*.md")):
        if p.name == "MEMORY.md":
            continue
        try:
            post = frontmatter.load(str(p))
            results.append({
                "filename": p.name,
                "name": post.metadata.get("name", p.stem),
                "description": post.metadata.get("description", ""),
                "type": post.metadata.get("type", ""),
                "body": post.content,
                "path": str(p),
            })
        except Exception:
            results.append({
                "filename": p.name,
                "name": p.stem,
                "description": "",
                "type": "",
                "body": p.read_text(encoding="utf-8"),
                "path": str(p),
            })
    return results


def get_memory_file(project_id: str, filename: str) -> dict:
    memory_dir = _resolve_memory_dir(project_id)
    safe = _safe_filename(filename)
    target = (memory_dir / safe).resolve()
    if not str(target).startswith(str(memory_dir)):
        raise ValueError("Path traversal detected")
    if not target.exists():
        raise FileNotFoundError(f"{safe} not found")
    post = frontmatter.load(str(target))
    return {
        "filename": safe,
        "frontmatter": {
            "name": post.metadata.get("name", target.stem),
            "description": post.metadata.get("description", ""),
            "type": post.metadata.get("type", ""),
        },
        "body": post.content,
    }


def write_memory_file(project_id: str, filename: str, meta: dict, body: str) -> str:
    memory_dir = _resolve_memory_dir(project_id)
    safe = _safe_filename(filename)
    target = (memory_dir / safe).resolve()
    if not str(target).startswith(str(memory_dir)):
        raise ValueError("Path traversal detected")

    post = frontmatter.Post(body, **{k: v for k, v in meta.items() if v is not None})
    content = frontmatter.dumps(post)

    tmp = target.with_suffix(".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, target)
    _rebuild_index(memory_dir)
    return safe


def delete_memory_file(project_id: str, filename: str) -> None:
    memory_dir = _resolve_memory_dir(project_id)
    safe = _safe_filename(filename)
    target = (memory_dir / safe).resolve()
    if not str(target).startswith(str(memory_dir)):
        raise ValueError("Path traversal detected")
    if not target.exists():
        raise FileNotFoundError(f"{safe} not found")
    target.unlink()
    _rebuild_index(memory_dir)


def _rebuild_index(memory_dir: Path) -> None:
    """Regenerate MEMORY.md from current .md files in the directory."""
    index_path = memory_dir / "MEMORY.md"
    files = sorted(
        p for p in memory_dir.glob("*.md") if p.name != "MEMORY.md"
    )

    lines = ["# Memory Index\n\n"]
    if files:
        lines.append("| File | Type | Description |\n")
        lines.append("|------|------|-------------|\n")
        for p in files:
            try:
                post = frontmatter.load(str(p))
                ftype = post.metadata.get("type", "")
                desc = post.metadata.get("description", "")
            except Exception:
                ftype = desc = ""
            lines.append(f"| [{p.name}]({p.name}) | {ftype} | {desc} |\n")

    tmp = index_path.with_suffix(".tmp")
    tmp.write_text("".join(lines), encoding="utf-8")
    os.replace(tmp, index_path)
