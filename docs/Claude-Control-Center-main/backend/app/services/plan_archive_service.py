from __future__ import annotations

import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

import orjson

from app.config import CLAUDE_DIR


def _plans_dir() -> Path:
    return CLAUDE_DIR / "plans"


def _completed_dir() -> Path:
    return _plans_dir() / "completed"


def _progress_dir() -> Path:
    return _plans_dir() / ".progress"


def _extract_title(content: str, slug: str) -> str:
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    return match.group(1).strip() if match else slug


def archive(slug: str) -> Path:
    """Move plan to completed/, append execution log, delete sidecar. Returns new path."""
    src = _plans_dir() / f"{slug}.md"
    if not src.exists():
        raise FileNotFoundError(f"Plan not found: {slug}")

    completed_dir = _completed_dir()
    completed_dir.mkdir(parents=True, exist_ok=True)
    dst = completed_dir / f"{slug}.md"

    # Read current content
    content = src.read_text(encoding="utf-8")

    # Read progress sidecar if it exists
    progress_path = _progress_dir() / f"{slug}.json"
    steps: list[dict] = []
    if progress_path.exists():
        try:
            data = orjson.loads(progress_path.read_bytes())
            steps = data.get("steps", [])
        except Exception:
            pass

    # Build execution log section
    log_lines = ["\n\n## Execution Log\n"]
    if steps:
        for step in sorted(steps, key=lambda s: s.get("id", 0)):
            status = "x" if step.get("checked") else " "
            text = step.get("text", f"Step {step.get('id', '?')}")
            log_lines.append(f"- [{status}] {text}")
            ev = step.get("evidence")
            if ev:
                log_lines.append(
                    f"  - source: {ev.get('source', '')}"
                    + (f", session: {ev.get('session_id', '')}" if ev.get("session_id") else "")
                    + (f"\n  - summary: {ev.get('tool_call_summary', '')}" if ev.get("tool_call_summary") else "")
                )
        completed_at = datetime.now(timezone.utc).isoformat()
        log_lines.append(f"\nArchived at: {completed_at}")
    else:
        log_lines.append("_(no progress data recorded)_")

    final_content = content + "\n".join(log_lines)

    # Atomically write to destination
    tmp = dst.with_suffix(".tmp")
    tmp.write_text(final_content, encoding="utf-8")
    os.replace(tmp, dst)

    # Remove source plan
    src.unlink(missing_ok=True)

    # Delete sidecar
    progress_path.unlink(missing_ok=True)

    return dst


def list_archived() -> list[dict]:
    """Scan completed/ dir, return [{slug, title, archivedAt}]."""
    completed_dir = _completed_dir()
    if not completed_dir.exists():
        return []

    results = []
    for p in sorted(completed_dir.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            content = p.read_text(encoding="utf-8")
        except Exception:
            content = ""
        results.append({
            "slug": p.stem,
            "title": _extract_title(content, p.stem),
            "archivedAt": datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
        })
    return results
