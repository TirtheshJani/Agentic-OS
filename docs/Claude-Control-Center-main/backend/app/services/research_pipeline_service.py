from __future__ import annotations

"""Orchestrate research jobs across YouTube, Reddit, and Firecrawl sources."""

import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import orjson

logger = logging.getLogger(__name__)

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "research_jobs.json"
_lock = threading.Lock()


def _load_jobs() -> list[dict]:
    if not _DATA_FILE.exists():
        return []
    try:
        with _lock:
            return orjson.loads(_DATA_FILE.read_bytes())
    except Exception:
        return []


def _save_jobs(jobs: list[dict]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _DATA_FILE.with_suffix(".tmp")
    with _lock:
        tmp.write_bytes(orjson.dumps(jobs, option=orjson.OPT_INDENT_2))
        os.replace(tmp, _DATA_FILE)


def _update_job(job_id: str, **updates) -> None:
    jobs = _load_jobs()
    for job in jobs:
        if job.get("id") == job_id:
            job.update(updates)
            break
    _save_jobs(jobs)


def create_job(
    title: str,
    query: str,
    sources: list[str],
    subreddits: list[str] | None = None,
    max_results: int = 10,
    vault_id: str | None = None,
) -> dict:
    job: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "title": title,
        "query": query,
        "sources": sources,
        "subreddits": subreddits or [],
        "max_results": max_results,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error": None,
        "results": {s: [] for s in sources},
        "ingested_count": 0,
        "vault_id": vault_id,
        "log": "",
    }
    jobs = _load_jobs()
    jobs.append(job)
    _save_jobs(jobs)
    return job


def get_job(job_id: str) -> dict | None:
    return next((j for j in _load_jobs() if j.get("id") == job_id), None)


def list_jobs() -> list[dict]:
    jobs = _load_jobs()
    return sorted(jobs, key=lambda j: j.get("created_at") or "", reverse=True)


def delete_job(job_id: str) -> bool:
    jobs = _load_jobs()
    new_jobs = [j for j in jobs if j.get("id") != job_id]
    if len(new_jobs) == len(jobs):
        return False
    _save_jobs(new_jobs)
    return True


def _collect_youtube(query: str, max_results: int) -> list[dict]:
    try:
        from app.services import youtube_collector
        return youtube_collector.search_youtube(query, max_results)
    except RuntimeError as exc:
        logger.warning("research_pipeline: youtube skipped: %s", exc)
        return []
    except Exception as exc:
        logger.warning("research_pipeline: youtube error: %s", exc)
        return []


def _collect_reddit(query: str, subreddits: list[str], max_results: int) -> list[dict]:
    try:
        from app.services import reddit_collector
        return reddit_collector.search_reddit(query, subreddits or None, max_results)
    except RuntimeError as exc:
        logger.warning("research_pipeline: reddit skipped: %s", exc)
        return []
    except Exception as exc:
        logger.warning("research_pipeline: reddit error: %s", exc)
        return []


def _collect_web(query: str, max_results: int) -> list[dict]:
    try:
        from app.services import firecrawl_collector
        return firecrawl_collector.search_web(query, max_results)
    except RuntimeError as exc:
        logger.warning("research_pipeline: firecrawl skipped: %s", exc)
        return []
    except Exception as exc:
        logger.warning("research_pipeline: firecrawl error: %s", exc)
        return []


def _build_text(source: str, item: dict) -> str:
    if source == "youtube":
        return f"YouTube: {item.get('title', '')}\n{item.get('url', '')}"
    elif source == "reddit":
        return (
            f"Reddit r/{item.get('subreddit', '')}: {item.get('title', '')}\n"
            f"{item.get('selftext', '')[:1000]}"
        )
    else:
        return f"{item.get('title', '')}\n{item.get('url', '')}\n{item.get('content', '')[:1000]}"


def _run_vault_pipeline(job_id: str) -> None:
    """Run vault-research-pipeline skill via `claude --dangerously-skip-permissions` subprocess."""
    import subprocess
    import shutil

    job = get_job(job_id)
    if job is None:
        return

    query = job["query"]
    claude_bin = shutil.which("claude") or os.path.expanduser("~/.local/bin/claude")
    if not os.path.isfile(claude_bin):
        _update_job(
            job_id,
            status="failed",
            completed_at=datetime.now(timezone.utc).isoformat(),
            error="claude CLI not found — install Claude Code first",
        )
        return

    prompt = f"vault research pipeline on: {query}"
    env = os.environ.copy()
    # Ensure standard tool paths are on PATH for the claude subprocess
    home = os.path.expanduser("~")
    npm_bin = os.path.join(home, ".npm", "bin")
    local_bin = os.path.join(home, ".local", "bin")
    env["PATH"] = f"/usr/local/bin:{local_bin}:{npm_bin}:{env.get('PATH', '')}"
    env["HOME"] = home
    # Forward obsidian host for Docker (host.docker.internal) if set in environment
    if "OBSIDIAN_BASE_URL" in os.environ:
        env["OBSIDIAN_BASE_URL"] = os.environ["OBSIDIAN_BASE_URL"]
    # Disable interactive prompts
    env["CLAUDE_NO_INTERACTIVE"] = "1"

    _update_job(job_id, status="running", log=f"[vault-research-pipeline] Starting: {prompt}\n")

    log_lines: list[str] = [f"[vault-research-pipeline] Starting: {prompt}\n"]

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
        for line in proc.stdout:
            log_lines.append(line)
            # Flush log to disk every 20 lines to keep it visible in the UI
            if len(log_lines) % 20 == 0:
                _update_job(job_id, log="".join(log_lines))

        proc.wait()
        final_log = "".join(log_lines)

        if proc.returncode == 0:
            _update_job(
                job_id,
                status="done",
                completed_at=datetime.now(timezone.utc).isoformat(),
                log=final_log,
                ingested_count=1,
                error=None,
            )
        else:
            _update_job(
                job_id,
                status="failed",
                completed_at=datetime.now(timezone.utc).isoformat(),
                log=final_log,
                error=f"claude exited with code {proc.returncode}",
            )

    except Exception as exc:
        logger.exception("vault_pipeline: job %s failed: %s", job_id, exc)
        _update_job(
            job_id,
            status="failed",
            completed_at=datetime.now(timezone.utc).isoformat(),
            log="".join(log_lines) + f"\n[error] {exc}",
            error=str(exc),
        )


def _run_job_blocking(job_id: str) -> None:
    job = get_job(job_id)
    if job is None:
        return

    # Route vault-pipeline jobs to their own runner
    if job.get("sources") == ["vault_pipeline"]:
        _run_vault_pipeline(job_id)
        return

    _update_job(job_id, status="running")

    query = job["query"]
    sources = job.get("sources", [])
    subreddits = job.get("subreddits", [])
    max_results = job.get("max_results", 10)
    vault_id = job.get("vault_id")
    results: dict[str, list[dict]] = {s: [] for s in sources}
    ingested_count = 0

    try:
        # Collect from each source
        if "youtube" in sources:
            results["youtube"] = _collect_youtube(query, max_results)

        if "reddit" in sources:
            results["reddit"] = _collect_reddit(query, subreddits, max_results)

        if "web" in sources:
            results["web"] = _collect_web(query, max_results)

        _update_job(job_id, results=results)

        # Ingest into RAG
        try:
            from app.services import memory_rag_service
            rag_status = memory_rag_service.get_status().get("status", "")
            if rag_status == "ready":
                for source, items in results.items():
                    for item in items:
                        text = _build_text(source, item)
                        if not text.strip():
                            continue
                        try:
                            memory_rag_service.insert(
                                text,
                                source=f"research:{job_id}:{source}",
                                tags=["research", source, query[:30]],
                            )
                            ingested_count += 1
                        except Exception as exc:
                            logger.debug("research_pipeline: RAG insert stopped: %s", exc)
                            break
        except Exception as exc:
            logger.warning("research_pipeline: RAG ingest error: %s", exc)

        # Push to Obsidian vault if configured
        if vault_id:
            try:
                from app.services import obsidian_sync_service
                obsidian_sync_service.sync_research_to_vault(vault_id, job_id)
            except Exception as exc:
                logger.warning("research_pipeline: vault push failed: %s", exc)

        _update_job(
            job_id,
            status="done",
            completed_at=datetime.now(timezone.utc).isoformat(),
            results=results,
            ingested_count=ingested_count,
            error=None,
        )

    except Exception as exc:
        logger.exception("research_pipeline: job %s failed: %s", job_id, exc)
        _update_job(
            job_id,
            status="failed",
            completed_at=datetime.now(timezone.utc).isoformat(),
            error=str(exc),
        )


def import_from_vault(vault_id: str) -> list[dict]:
    """Scan an Obsidian vault's research/ folder and create done vault_pipeline jobs for each file not already imported."""
    import re as _re
    from app.services import obsidian_vault_service

    vault = next((v for v in obsidian_vault_service.list_vaults() if v.get("id") == vault_id), None)
    if vault is None:
        raise ValueError(f"Vault not found: {vault_id}")

    vault_path = Path(vault["path"])
    research_dir = vault_path / "research"
    if not research_dir.exists():
        return []

    existing_jobs = _load_jobs()
    # Use file path as dedup key
    existing_paths: set[str] = {j.get("vault_source_path", "") for j in existing_jobs}

    created: list[dict] = []

    for md_file in sorted(research_dir.glob("*.md")):
        rel_path = str(md_file.relative_to(vault_path))
        if rel_path in existing_paths:
            continue

        text = md_file.read_text(encoding="utf-8", errors="ignore")

        # Parse YAML frontmatter
        fm: dict[str, str] = {}
        fm_match = _re.match(r"^---\n(.*?)\n---", text, _re.DOTALL)
        if fm_match:
            for line in fm_match.group(1).splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    fm[k.strip()] = v.strip().strip('"').strip("'")

        title = fm.get("title", "") or md_file.stem.replace("-", " ").title()
        # Strip leading "YouTube Research: " prefix if present
        query = _re.sub(r"^YouTube Research:\s*", "", title, flags=_re.IGNORECASE).strip()
        date_str = fm.get("date", "")
        notebooklm_id = fm.get("notebooklm_id", "")

        # Count YouTube sources from the table (lines starting with "| N |")
        source_rows = [ln for ln in text.splitlines() if _re.match(r"^\|\s*\d+\s*\|", ln)]
        ingested_count = len(source_rows) if source_rows else 1

        # Parse created_at from frontmatter date or file mtime
        try:
            from datetime import date as _date
            dt = datetime.fromisoformat(date_str) if date_str else datetime.fromtimestamp(md_file.stat().st_mtime, tz=timezone.utc)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            created_at = dt.isoformat()
        except Exception:
            created_at = datetime.now(timezone.utc).isoformat()

        job: dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "title": title,
            "query": query,
            "sources": ["vault_pipeline"],
            "subreddits": [],
            "max_results": ingested_count,
            "status": "done",
            "created_at": created_at,
            "completed_at": created_at,
            "error": None,
            "results": {},
            "ingested_count": ingested_count,
            "vault_id": vault_id,
            "vault_source_path": rel_path,
            "log": f"[imported] Source: {rel_path}\n"
                   + (f"NotebookLM ID: {notebooklm_id}\n" if notebooklm_id else "")
                   + f"YouTube sources found: {ingested_count}\n",
        }

        existing_jobs.append(job)
        created.append(job)
        existing_paths.add(rel_path)

    if created:
        _save_jobs(existing_jobs)

    return created


def run_job(job_id: str) -> None:
    """Execute job synchronously (call from a thread)."""
    _run_job_blocking(job_id)


def trigger_job(job_id: str) -> None:
    """Start job in background thread."""
    t = threading.Thread(target=_run_job_blocking, args=(job_id,), daemon=True, name=f"research-{job_id[:8]}")
    t.start()
