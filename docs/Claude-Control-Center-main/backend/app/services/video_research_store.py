"""Persistence + paths for video research jobs.

Owns the on-disk job index (``data/video_research_jobs.json``) and per-job
artifact directories (``data/video_research/{slug}/``). Pure storage — no
subprocess or pipeline logic (that lives in ``video_research_runner``).
"""
from __future__ import annotations

import os
import re
import threading
from pathlib import Path

import orjson

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_DATA_FILE = _DATA_DIR / "video_research_jobs.json"
JOBS_DIR = _DATA_DIR / "video_research"
_lock = threading.Lock()

DELIVERABLE_FILES = (
    "script.md",
    "storyboard.md",
    "titles.json",
    "thumbnail_concepts.md",
    "show_notes.md",
)


def load_jobs() -> list[dict]:
    if not _DATA_FILE.exists():
        return []
    try:
        with _lock:
            return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return []


def save_jobs(jobs: list[dict]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _DATA_FILE.with_suffix(".tmp")
    with _lock:
        tmp.write_bytes(orjson.dumps(jobs, option=orjson.OPT_INDENT_2))
        os.replace(tmp, _DATA_FILE)


def get_job(job_id: str) -> dict | None:
    return next((j for j in load_jobs() if j.get("id") == job_id), None)


def update_job(job_id: str, **updates) -> dict | None:
    jobs = load_jobs()
    found = None
    for job in jobs:
        if job.get("id") == job_id:
            job.update(updates)
            found = job
            break
    if found is not None:
        save_jobs(jobs)
    return found


def append_log(job_id: str, text: str) -> None:
    job = get_job(job_id)
    if job is None:
        return
    current = job.get("log", "") or ""
    update_job(job_id, log=current + text)


def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
    return slug or "video"


def job_dir(job: dict) -> Path:
    return JOBS_DIR / job["slug"]


def get_deliverable_path(job: dict, name: str) -> Path | None:
    if name not in DELIVERABLE_FILES and name not in ("research_summary.md", "angles.json"):
        return None
    path = job_dir(job) / name
    return path if path.exists() else None
