#!/usr/bin/env python3
"""
memory_curator.py -- Sync vault knowledge to an Anthropic Memory Store.

Usage:
    python memory_curator.py [--days 7] [--dream] [--vault-path PATH]

Requires:
    ANTHROPIC_API_KEY environment variable
    pip install anthropic (>=0.40.0 for Memory API)

Memory store layout:
    /vault/daily-activity.md    recent daily notes summary
    /vault/wiki-knowledge.md    wiki content snapshot

State persisted at:
    vault/projects/memory-curator/state.json
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

try:
    import anthropic
except ImportError:
    sys.exit("ERROR: Install anthropic SDK: pip install anthropic")

BETA_HEADER = "managed-agents-2026-04-01"
DREAM_BETA = "dreaming-2026-04-21"
STATE_RELATIVE = "vault/projects/memory-curator/state.json"
MEMORY_CAP_BYTES = 90_000


def repo_root_from_script() -> Path:
    # scripts/ -> memory-curator/ -> _meta/ -> skills/ -> repo root
    return Path(__file__).resolve().parent.parent.parent.parent


def get_client(extra_headers: dict | None = None) -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("ERROR: ANTHROPIC_API_KEY is not set in environment")
    headers = {"anthropic-beta": BETA_HEADER}
    if extra_headers:
        headers.update(extra_headers)
    return anthropic.Anthropic(api_key=api_key, default_headers=headers)


def load_state(repo_root: Path) -> dict:
    state_path = repo_root / STATE_RELATIVE
    if state_path.exists():
        return json.loads(state_path.read_text(encoding="utf-8"))
    return {}


def save_state(repo_root: Path, state: dict) -> None:
    state_path = repo_root / STATE_RELATIVE
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2, default=str), encoding="utf-8")
    print(f"State saved: {state_path}")


def get_or_create_store(client: anthropic.Anthropic, state: dict) -> str:
    if "memory_store_id" in state:
        print(f"Reusing memory store: {state['memory_store_id']}")
        return state["memory_store_id"]
    store = client.beta.memory_stores.create(
        name="agentic-os-knowledge",
        description=(
            "Accumulated knowledge from Agentic-OS skill runs: "
            "vault daily notes, wiki pages, skill output history."
        ),
    )
    print(f"Created memory store: {store.id}")
    return store.id


def read_vault_daily(vault_path: Path, days: int) -> str:
    daily_dir = vault_path / "raw" / "daily"
    if not daily_dir.exists():
        return ""
    cutoff = datetime.now() - timedelta(days=days)
    notes: list[str] = []
    for f in sorted(daily_dir.glob("*.md")):
        try:
            date_str = f.stem[:10]
            file_date = datetime.strptime(date_str, "%Y-%m-%d")
            if file_date >= cutoff:
                text = f.read_text(encoding="utf-8", errors="replace")
                notes.append(f"## {date_str}\n\n{text}")
        except (ValueError, OSError):
            continue
    return "\n\n---\n\n".join(notes)


def read_vault_wiki(vault_path: Path) -> str:
    wiki_dir = vault_path / "wiki"
    if not wiki_dir.exists():
        return ""
    pages: list[str] = []
    for f in sorted(wiki_dir.rglob("*.md")):
        try:
            rel = f.relative_to(wiki_dir)
            text = f.read_text(encoding="utf-8", errors="replace")
            pages.append(f"## {rel}\n\n{text}")
        except OSError:
            continue
    return "\n\n---\n\n".join(pages)


def cap_content(content: str) -> str:
    raw = content.encode("utf-8")
    if len(raw) <= MEMORY_CAP_BYTES:
        return content
    truncated = raw[:MEMORY_CAP_BYTES].decode("utf-8", errors="ignore")
    return truncated + "\n\n[...truncated to fit 90 KB memory limit]"


def upsert_memory(client: anthropic.Anthropic, store_id: str, path: str, content: str) -> None:
    if not content.strip():
        print(f"  Skipping {path} (empty)")
        return
    content = cap_content(content)
    existing = client.beta.memory_stores.memories.list(store_id, path_prefix=path)
    if existing.data:
        mem = existing.data[0]
        client.beta.memory_stores.memories.update(
            mem.id,
            memory_store_id=store_id,
            content=content,
        )
        print(f"  Updated  {path}  ({len(content):,} chars)")
    else:
        client.beta.memory_stores.memories.create(
            memory_store_id=store_id,
            path=path,
            content=content,
        )
        print(f"  Created  {path}  ({len(content):,} chars)")


def run_dream(store_id: str, api_key: str) -> str:
    dream_client = anthropic.Anthropic(
        api_key=api_key,
        default_headers={"anthropic-beta": f"{BETA_HEADER},{DREAM_BETA}"},
    )
    dream = dream_client.beta.dreams.create(memory_store_id=store_id)
    print(f"Dream job started: {dream.id}  (status: {dream.status})")

    for attempt in range(30):
        time.sleep(10)
        dream = dream_client.beta.dreams.retrieve(dream.id)
        print(f"  [{attempt + 1}/30] Dream status: {dream.status}")
        if dream.status in ("completed", "failed", "canceled"):
            break

    if dream.status == "completed":
        output_id = getattr(dream, "output_memory_store_id", None)
        print(f"Dream completed. Output store: {output_id or '(same store)'}")
        return output_id or store_id

    print(f"Dream finished with status: {dream.status}")
    return store_id


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync vault to Anthropic Memory Store")
    parser.add_argument("--days", type=int, default=7, help="Days of daily notes to include")
    parser.add_argument("--dream", action="store_true", help="Trigger Dream consolidation after sync")
    parser.add_argument("--vault-path", default="vault", help="Path to vault directory")
    args = parser.parse_args()

    repo_root = repo_root_from_script()
    vault_path = (repo_root / args.vault_path).resolve()

    print(f"Repo root : {repo_root}")
    print(f"Vault path: {vault_path}")
    print(f"Daily window: last {args.days} days")
    if not vault_path.is_dir():
        sys.exit(f"ERROR: vault not found at {vault_path}")

    client = get_client()
    state = load_state(repo_root)
    store_id = get_or_create_store(client, state)
    state["memory_store_id"] = store_id
    state["last_sync"] = datetime.now().isoformat()

    print("\nReading vault...")
    daily = read_vault_daily(vault_path, args.days)
    wiki = read_vault_wiki(vault_path)

    print("\nSyncing to memory store...")
    upsert_memory(
        client,
        store_id,
        "/vault/daily-activity.md",
        f"# Recent Daily Notes (last {args.days} days)\nUpdated: {datetime.now().date()}\n\n{daily}",
    )
    upsert_memory(
        client,
        store_id,
        "/vault/wiki-knowledge.md",
        f"# Wiki Knowledge Snapshot\nUpdated: {datetime.now().date()}\n\n{wiki}",
    )

    if args.dream:
        print("\nTriggering Dream consolidation job...")
        api_key = os.environ["ANTHROPIC_API_KEY"]
        new_store_id = run_dream(store_id, api_key)
        if new_store_id != store_id:
            state["memory_store_id"] = new_store_id
            print(f"Memory store updated to dreamed output: {new_store_id}")

    save_state(repo_root, state)
    print(f"\nDone. Memory store ID: {state['memory_store_id']}")
