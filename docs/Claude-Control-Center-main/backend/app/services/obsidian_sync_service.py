from __future__ import annotations

"""Bidirectional sync: push RAG summaries and plans back into Obsidian as notes."""

import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path

from app.services import obsidian_vault_service


def _find_vault(vault_id: str) -> dict | None:
    return next((v for v in obsidian_vault_service.list_vaults() if v.get("id") == vault_id), None)


def trigger_vault_ingest(vault_id: str) -> dict:
    """Kick off a background scan that pushes every vault note into the RAG store.

    Returns immediately after spawning the worker thread. Raises ``ValueError``
    if the vault is unknown or disabled.
    """
    vault = _find_vault(vault_id)
    if vault is None:
        raise ValueError("Vault not found")
    if not vault.get("enabled"):
        raise ValueError("Vault is disabled")

    def _do_ingest() -> None:
        vault_path = Path(vault["path"])
        try:
            from app.services import memory_rag_service
            if memory_rag_service.get_status().get("status", "") != "ready":
                return
            for md in vault_path.rglob("*.md"):
                try:
                    content = md.read_text(encoding="utf-8", errors="ignore")
                    rel = str(md.relative_to(vault_path))
                    memory_rag_service.insert(
                        content,
                        source=f"obsidian:{vault_id}:{rel}",
                        tags=["obsidian", vault.get("name", vault_id)],
                    )
                except Exception:
                    pass
            obsidian_vault_service.update_vault(
                vault_id,
                last_synced=datetime.now(timezone.utc).isoformat(),
            )
        except Exception:
            pass

    threading.Thread(target=_do_ingest, daemon=True).start()
    return {"queued": True, "vault_id": vault_id}


def vault_sync_status(vault_id: str) -> dict:
    """Return last-synced timestamp, note count, and readiness for a vault."""
    vault = _find_vault(vault_id)
    if vault is None:
        raise ValueError("Vault not found")
    vault_path = Path(vault["path"])
    notes_count = sum(1 for _ in vault_path.rglob("*.md")) if vault_path.exists() else 0
    return {
        "last_synced": vault.get("last_synced"),
        "notes_count": notes_count,
        "ready": vault_path.exists() and vault.get("enabled", False),
    }


def _slugify(title: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", title.lower())
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
    return slug or "note"


def _build_frontmatter(tags: list[str] | None, source: str = "ccc") -> str:
    tags_str = ", ".join(f'"{t}"' for t in (tags or []))
    now = datetime.now(timezone.utc).isoformat()
    return f"---\ntags: [{tags_str}]\ncreated: {now}\nsource: {source}\n---\n\n"


def push_to_vault(
    vault_id: str,
    title: str,
    content: str,
    folder: str = "CCC-Research",
    tags: list[str] | None = None,
) -> dict:
    """Create or overwrite a note in the vault with frontmatter."""
    vault = next((v for v in obsidian_vault_service.list_vaults() if v.get("id") == vault_id), None)
    if vault is None:
        raise ValueError(f"Vault not found: {vault_id}")

    vault_path = Path(vault["path"]).resolve()
    folder_path = vault_path / folder
    folder_path.mkdir(parents=True, exist_ok=True)

    filename = f"{_slugify(title)}.md"
    note_path = folder_path / filename

    all_tags = ["ccc-generated"] + (tags or [])
    frontmatter = _build_frontmatter(all_tags)
    full_content = f"# {title}\n\n{frontmatter}{content}"

    # Atomic write
    tmp = note_path.with_suffix(".tmp")
    tmp.write_text(full_content, encoding="utf-8")
    os.replace(tmp, note_path)

    rel = str(note_path.relative_to(vault_path))
    return {"vault_id": vault_id, "path": rel, "written": True}


def sync_plan_to_vault(vault_id: str, slug: str) -> dict:
    """Read plan markdown and push to vault under Plans/ folder."""
    from app.config import CLAUDE_DIR
    plan_file = CLAUDE_DIR / "plans" / f"{slug}.md"
    if not plan_file.exists():
        raise FileNotFoundError(f"Plan not found: {slug}")
    content = plan_file.read_text(encoding="utf-8")
    return push_to_vault(
        vault_id,
        title=slug,
        content=content,
        folder="Plans",
        tags=["plan"],
    )


def sync_research_to_vault(vault_id: str, research_id: str) -> dict:
    """Push a research job's assembled markdown to the Research folder."""
    from pathlib import Path as _Path
    from app.services import research_pipeline_service
    job = research_pipeline_service.get_job(research_id)
    if job is None:
        raise ValueError(f"Research job not found: {research_id}")

    lines = [f"## Research Results: {job.get('query', research_id)}\n"]
    results = job.get("results", {})
    for source, items in results.items():
        if not items:
            continue
        lines.append(f"\n### {source.capitalize()}\n")
        for item in items:
            title = item.get("title", "")
            url = item.get("url", item.get("permalink", ""))
            snippet = item.get("content") or item.get("selftext") or item.get("transcript_text", "")
            if isinstance(snippet, str):
                snippet = snippet[:500]
            lines.append(f"- **{title}**")
            if url:
                lines.append(f"  - URL: {url}")
            if snippet:
                lines.append(f"  - {snippet[:200]}")

    assembled = "\n".join(lines)
    return push_to_vault(
        vault_id,
        title=f"Research: {job.get('query', research_id)}",
        content=assembled,
        folder="Research",
        tags=["research"],
    )
