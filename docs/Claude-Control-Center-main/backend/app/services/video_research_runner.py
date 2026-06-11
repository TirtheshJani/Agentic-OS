"""Claude subprocess runner + phase state machine for video research jobs.

Each job runs through up to three resumable phases:
  research  -> writes research_summary.md
  angles    -> (topic-exploration only) writes angles.json, then pauses
  synthesis -> writes script.md, storyboard.md, titles.json, ...

Job persistence lives in ``video_research_store``; prompt construction in
``video_prompts``.
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import threading
from datetime import datetime, timezone

from app.services import video_prompts
from app.services import video_research_store as store

logger = logging.getLogger(__name__)

DELIVERABLE_FILES = store.DELIVERABLE_FILES


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- claude subprocess runner ----------

def _claude_env() -> dict[str, str]:
    env = os.environ.copy()
    home = os.path.expanduser("~")
    npm_bin = os.path.join(home, ".npm", "bin")
    local_bin = os.path.join(home, ".local", "bin")
    env["PATH"] = f"/usr/local/bin:{local_bin}:{npm_bin}:{env.get('PATH', '')}"
    env["HOME"] = home
    if "OBSIDIAN_BASE_URL" in os.environ:
        env["OBSIDIAN_BASE_URL"] = os.environ["OBSIDIAN_BASE_URL"]
    env["CLAUDE_NO_INTERACTIVE"] = "1"
    return env


def resolve_claude_bin() -> str | None:
    claude_bin = shutil.which("claude") or os.path.expanduser("~/.local/bin/claude")
    return claude_bin if os.path.isfile(claude_bin) else None


def _run_claude(job_id: str, label: str, prompt: str) -> bool:
    """Run `claude --dangerously-skip-permissions <prompt>` streaming stdout into the job log. Returns True on rc 0."""
    claude_bin = resolve_claude_bin()
    if claude_bin is None:
        store.update_job(
            job_id,
            status="failed",
            completed_at=_now(),
            error="claude CLI not found — install Claude Code first",
        )
        return False

    store.append_log(job_id, f"\n[{label}] prompt size: {len(prompt)} chars\n[{label}] starting...\n")
    env = _claude_env()

    try:
        proc = subprocess.Popen(
            [claude_bin, "--dangerously-skip-permissions", prompt],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
            env=env,
            bufsize=1,
        )
        assert proc.stdout is not None

        buffer: list[str] = []
        line_count = 0
        for line in proc.stdout:
            buffer.append(line)
            line_count += 1
            if line_count % 20 == 0:
                store.append_log(job_id, "".join(buffer))
                buffer.clear()
        if buffer:
            store.append_log(job_id, "".join(buffer))
        proc.wait()
        store.append_log(job_id, f"[{label}] exited with code {proc.returncode}\n")
        return proc.returncode == 0
    except Exception as exc:
        logger.exception("video_research[%s]: %s phase failed", job_id, label)
        store.append_log(job_id, f"[{label}] error: {exc}\n")
        return False


# ---------- phase runners ----------

def _run_research_phase(job: dict) -> bool:
    out_dir = store.job_dir(job)
    out_dir.mkdir(parents=True, exist_ok=True)
    if (out_dir / "research_summary.md").exists():
        store.append_log(job["id"], "[research] skipped (research_summary.md already exists)\n")
        return True
    prompt = video_prompts.research_prompt(job["topic"], out_dir, job.get("vault_id"))
    return _run_claude(job["id"], "research", prompt)


def _run_angles_phase(job: dict) -> bool:
    out_dir = store.job_dir(job)
    angles_path = out_dir / "angles.json"
    if angles_path.exists():
        store.append_log(job["id"], "[angles] skipped (angles.json already exists)\n")
        return True
    research_path = out_dir / "research_summary.md"
    prompt = video_prompts.angles_prompt(job["topic"], research_path, out_dir)
    return _run_claude(job["id"], "angles", prompt)


def _run_synthesis_phase(job: dict) -> bool:
    out_dir = store.job_dir(job)
    research_path = out_dir / "research_summary.md"
    missing = [f for f in DELIVERABLE_FILES if not (out_dir / f).exists()]
    if not missing:
        store.append_log(job["id"], "[synthesis] skipped (all deliverables already exist)\n")
        return True
    prompt = video_prompts.synthesis_prompt(
        topic=job["topic"],
        angle=job.get("picked_angle"),
        video_format=job.get("format", "long"),
        research_path=research_path,
        out_dir=out_dir,
    )
    return _run_claude(job["id"], "synthesis", prompt)


# ---------- state machine ----------

def _run_job_blocking(job_id: str) -> None:
    job = store.get_job(job_id)
    if job is None:
        return

    store.update_job(job_id, status="running", error=None)

    try:
        # Phase 1: research (always)
        store.update_job(job_id, phase="research")
        if not _run_research_phase(store.get_job(job_id) or job):
            store.update_job(job_id, status="failed", completed_at=_now(), error="research phase failed")
            return

        mode = job.get("mode", "single-video")

        if mode == "topic-exploration":
            # Phase 2: angles, then pause for user pick
            store.update_job(job_id, phase="angles")
            if not _run_angles_phase(store.get_job(job_id) or job):
                store.update_job(job_id, status="failed", completed_at=_now(), error="angles phase failed")
                return
            store.update_job(job_id, status="awaiting_pick", phase="angles")
            return

        # Phase 3: synthesis (single-video mode)
        store.update_job(job_id, phase="synthesis")
        if not _run_synthesis_phase(store.get_job(job_id) or job):
            store.update_job(job_id, status="failed", completed_at=_now(), error="synthesis phase failed")
            return

        store.update_job(job_id, status="done", phase="done", completed_at=_now())
    except Exception as exc:
        logger.exception("video_research: job %s crashed", job_id)
        store.update_job(job_id, status="failed", completed_at=_now(), error=str(exc))


def trigger_job(job_id: str) -> None:
    t = threading.Thread(
        target=_run_job_blocking,
        args=(job_id,),
        daemon=True,
        name=f"video-research-{job_id[:8]}",
    )
    t.start()
