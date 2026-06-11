"""Plan file reading, metadata extraction, and progress merging.

Keeps the plans blueprint thin: all filesystem access, slug/path validation,
title/preview parsing, and the merge of markdown checkboxes with the progress
sidecar live here.
"""
from __future__ import annotations

import re
from pathlib import Path

from app.config import CLAUDE_DIR
from app.services import plan_progress_service
from app.services.plan_step_parser import parse_steps


def _plans_dir() -> Path:
    return CLAUDE_DIR / "plans"


def _extract_title(content: str, slug: str) -> str:
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    return match.group(1).strip() if match else slug


def _extract_preview(content: str) -> str:
    """Return first ~200 chars after the Context heading."""
    match = re.search(r"##\s+Context\s*\n+([\s\S]{0,300})", content)
    if match:
        text = match.group(1).strip()
        return text[:200] + ("…" if len(text) > 200 else "")
    return content[:200]


def _resolve_slug(slug: str) -> Path:
    """Resolve ``slug`` to a path inside the plans dir, rejecting traversal."""
    plans_dir = _plans_dir()
    target = (plans_dir / f"{slug}.md").resolve()
    if not str(target).startswith(str(plans_dir.resolve())):
        raise ValueError("Invalid slug")
    return target


def list_plans() -> list[dict]:
    plans_dir = _plans_dir()
    if not plans_dir.is_dir():
        return []
    results = []
    for p in sorted(plans_dir.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
        content = p.read_text(encoding="utf-8")
        results.append({
            "slug": p.stem,
            "title": _extract_title(content, p.stem),
            "preview": _extract_preview(content),
            "modifiedAt": p.stat().st_mtime,
        })
    return results


def get_plan(slug: str) -> dict:
    """Return a single plan's content. Raises ValueError (bad slug) or
    FileNotFoundError (missing)."""
    target = _resolve_slug(slug)
    if not target.exists():
        raise FileNotFoundError("Plan not found")
    content = target.read_text(encoding="utf-8")
    return {
        "slug": slug,
        "title": _extract_title(content, slug),
        "raw": content,
        "modifiedAt": target.stat().st_mtime,
    }


def get_progress(slug: str) -> dict:
    """Merge markdown checkbox steps with the progress sidecar. Raises
    ValueError for an invalid slug; returns empty progress if the plan is gone."""
    target = _resolve_slug(slug)
    if not target.exists():
        return {"steps": [], "completed": 0, "total": 0}

    md_steps = parse_steps(target.read_text(encoding="utf-8"))
    progress = plan_progress_service.read(slug)
    sidecar_by_id: dict = {}
    if progress:
        for s in progress.get("steps", []):
            sidecar_by_id[int(s.get("id", -1))] = s

    merged: list[dict] = []
    for s in md_steps:
        sid = int(s["id"])
        sc = sidecar_by_id.get(sid, {})
        merged.append({
            "id": sid,
            "text": s["text"],
            "checked": sc.get("checked", s["checked"]),
            "evidence": sc.get("evidence"),
        })

    completed = sum(1 for step in merged if step["checked"])
    return {"steps": merged, "completed": completed, "total": len(merged)}
