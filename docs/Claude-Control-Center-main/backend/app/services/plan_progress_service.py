from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import orjson

from app.config import CLAUDE_DIR

_lock = threading.Lock()


def _progress_dir() -> Path:
    return CLAUDE_DIR / "plans" / ".progress"


def _active_dir() -> Path:
    return CLAUDE_DIR / "plans" / ".active"


def _progress_path(slug: str) -> Path:
    return _progress_dir() / f"{slug}.json"


def read(slug: str) -> dict | None:
    """Read the progress sidecar for a plan slug. Returns None if not found."""
    path = _progress_path(slug)
    if not path.exists():
        return None
    try:
        with _lock:
            return orjson.loads(path.read_bytes())
    except Exception:
        return None


def write(slug: str, steps: list[dict]) -> None:
    """Atomically write progress sidecar for slug."""
    _progress_dir().mkdir(parents=True, exist_ok=True)
    path = _progress_path(slug)
    data: dict[str, Any] = {
        "slug": slug,
        "steps": steps,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    tmp = path.with_suffix(".tmp")
    with _lock:
        tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
        os.replace(tmp, path)


def toggle_step(slug: str, step_id: int, checked: bool, evidence: dict | None = None) -> dict:
    """Read → modify → write the progress sidecar for a single step toggle.

    Creates the sidecar if it doesn't exist yet.
    """
    existing = read(slug) or {"slug": slug, "steps": [], "updated_at": ""}
    steps: list[dict] = existing.get("steps", [])

    # Find or create the step entry
    step = next((s for s in steps if s.get("id") == step_id), None)
    if step is None:
        step = {"id": step_id}
        steps.append(step)

    step["checked"] = checked
    if checked:
        step["completed_at"] = datetime.now(timezone.utc).isoformat()
    else:
        step.pop("completed_at", None)

    if evidence is not None:
        step["evidence"] = evidence
    elif "evidence" in step and not checked:
        step.pop("evidence", None)

    write(slug, steps)
    return step


def pin_session(slug: str, session_id: str) -> None:
    """Write marker file ~/.claude/plans/.active/<session_id> with content = slug."""
    active_dir = _active_dir()
    active_dir.mkdir(parents=True, exist_ok=True)
    marker = active_dir / session_id
    marker.write_text(slug, encoding="utf-8")


def get_pinned_slug(session_id: str) -> str | None:
    """Return the slug pinned to this session_id, or None."""
    marker = _active_dir() / session_id
    if not marker.exists():
        return None
    try:
        return marker.read_text(encoding="utf-8").strip() or None
    except Exception:
        return None
