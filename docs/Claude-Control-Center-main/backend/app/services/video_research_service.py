from __future__ import annotations

"""Video research pipeline — public API (facade).

Job persistence + paths live in ``video_research_store``; the Claude subprocess
runner + phase state machine live in ``video_research_runner``. This module
exposes the CRUD, search, vault-sync, and source-availability surface used by
the routes and keeps the historical ``video_research_service.xxx()`` API.
"""

import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import orjson

from app.services import video_research_store as store
from app.services.video_research_runner import resolve_claude_bin, trigger_job

logger = logging.getLogger(__name__)

VALID_MODES = {"single-video", "topic-exploration"}
VALID_FORMATS = {"long", "short"}
DELIVERABLE_FILES = store.DELIVERABLE_FILES

# Re-exported so callers keep importing these from video_research_service.
get_deliverable_path = store.get_deliverable_path
get_job = store.get_job


# ---------- public CRUD ----------

def create_job(
    topic: str,
    mode: str = "single-video",
    video_format: str = "long",
    vault_id: str | None = None,
    parent_job_id: str | None = None,
    angle: dict | None = None,
) -> dict:
    if mode not in VALID_MODES:
        raise ValueError(f"invalid mode: {mode}")
    if video_format not in VALID_FORMATS:
        raise ValueError(f"invalid format: {video_format}")
    if not topic.strip():
        raise ValueError("topic is required")

    job_id = str(uuid.uuid4())
    slug = f"{store.slugify(topic)[:60]}-{job_id[:6]}"
    job_dir = store.JOBS_DIR / slug
    job_dir.mkdir(parents=True, exist_ok=True)

    job: dict[str, Any] = {
        "id": job_id,
        "slug": slug,
        "topic": topic.strip(),
        "mode": mode,
        "format": video_format,
        "vault_id": vault_id,
        "parent_job_id": parent_job_id,
        "picked_angle": angle,
        "status": "pending",
        "phase": "research",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error": None,
        "log": "",
        "deliverables_path": str(job_dir),
        "vault_mirror_path": None,
    }
    jobs = store.load_jobs()
    jobs.append(job)
    store.save_jobs(jobs)
    return job


def list_jobs() -> list[dict]:
    jobs = store.load_jobs()
    return sorted(jobs, key=lambda j: j.get("created_at") or "", reverse=True)


def delete_job(job_id: str) -> bool:
    jobs = store.load_jobs()
    target = next((j for j in jobs if j.get("id") == job_id), None)
    if target is None:
        return False
    new_jobs = [j for j in jobs if j.get("id") != job_id]
    store.save_jobs(new_jobs)
    # Best-effort artifact cleanup
    try:
        job_dir = store.JOBS_DIR / target["slug"]
        if job_dir.exists():
            shutil.rmtree(job_dir, ignore_errors=True)
    except Exception as exc:
        logger.warning("video_research: failed to remove %s: %s", target.get("slug"), exc)
    return True


def search_jobs(query: str) -> list[dict]:
    """Search past job topics + research summaries (knowledge base)."""
    q = query.lower().strip()
    if not q:
        return []
    matches: list[dict] = []
    for job in list_jobs():
        if q in (job.get("topic", "") or "").lower():
            matches.append({"job": job, "where": "topic"})
            continue
        summary = store.job_dir(job) / "research_summary.md"
        if summary.exists():
            try:
                text = summary.read_text(encoding="utf-8", errors="ignore").lower()
                if q in text:
                    matches.append({"job": job, "where": "summary"})
            except Exception:
                continue
    return matches


def pick_angle(parent_job_id: str, angle_index: int) -> dict:
    parent = get_job(parent_job_id)
    if parent is None:
        raise ValueError("parent job not found")
    if parent.get("mode") != "topic-exploration":
        raise ValueError("pick_angle only applies to topic-exploration jobs")

    angles_path = store.job_dir(parent) / "angles.json"
    if not angles_path.exists():
        raise ValueError("angles.json not yet generated")

    try:
        data = orjson.loads(angles_path.read_bytes())
        angles = data.get("angles", [])
    except Exception as exc:
        raise ValueError(f"invalid angles.json: {exc}")

    if angle_index < 0 or angle_index >= len(angles):
        raise ValueError(f"angle_index out of range (0..{len(angles) - 1})")

    angle = angles[angle_index]
    child_format = angle.get("format_hint") if angle.get("format_hint") in VALID_FORMATS else parent.get("format", "long")
    child = create_job(
        topic=angle.get("title") or parent["topic"],
        mode="single-video",
        video_format=child_format,
        vault_id=parent.get("vault_id"),
        parent_job_id=parent_job_id,
        angle=angle,
    )
    store.update_job(parent_job_id, status="done", phase="angles", completed_at=datetime.now(timezone.utc).isoformat())
    trigger_job(child["id"])
    return child


# ---------- vault sync ----------

def sync_to_vault(job_id: str, vault_id: str | None = None) -> dict:
    from app.services import obsidian_vault_service

    job = get_job(job_id)
    if job is None:
        raise ValueError("job not found")

    target_vault_id = vault_id or job.get("vault_id")
    if not target_vault_id:
        raise ValueError("no vault_id provided and job has no default vault_id")

    vault = next((v for v in obsidian_vault_service.list_vaults() if v.get("id") == target_vault_id), None)
    if vault is None:
        raise ValueError(f"vault not found: {target_vault_id}")

    vault_path = Path(vault["path"]).resolve()
    target_dir = vault_path / "Videos" / job["slug"]
    target_dir.mkdir(parents=True, exist_ok=True)

    src_dir = store.job_dir(job)
    copied: list[str] = []
    for name in ("research_summary.md", "angles.json", *DELIVERABLE_FILES):
        src = src_dir / name
        if not src.exists():
            continue
        dst = target_dir / name
        tmp = dst.with_suffix(dst.suffix + ".tmp")
        tmp.write_bytes(src.read_bytes())
        os.replace(tmp, dst)
        copied.append(name)

    rel = str(target_dir.relative_to(vault_path))
    store.update_job(job_id, vault_mirror_path=rel)
    return {"vault_id": target_vault_id, "path": rel, "files": copied}


# ---------- source availability ----------

def sources_status() -> dict:
    """Report which research backends (YouTube, web, Claude CLI) are usable."""
    try:
        import yt_dlp  # type: ignore  # noqa: F401
        yt_available = True
    except ImportError:
        yt_available = False

    try:
        from firecrawl import FirecrawlApp  # type: ignore  # noqa: F401
        firecrawl_installed = True
    except ImportError:
        firecrawl_installed = False
    firecrawl_configured = bool(os.getenv("FIRECRAWL_API_KEY"))

    claude_available = resolve_claude_bin() is not None

    return {
        "youtube": {"available": yt_available},
        "web": {"available": firecrawl_installed, "configured": firecrawl_configured},
        "claude_cli": {"available": claude_available, "configured": claude_available},
    }


# ---------- startup hook ----------

def startup_reset_running_jobs() -> None:
    """Reset stuck running jobs to pending on backend startup (no auto-resume)."""
    jobs = store.load_jobs()
    changed = False
    for job in jobs:
        if job.get("status") == "running":
            job["status"] = "pending"
            job["log"] = (job.get("log") or "") + "\n[startup] backend restarted; job reset to pending\n"
            changed = True
    if changed:
        store.save_jobs(jobs)
