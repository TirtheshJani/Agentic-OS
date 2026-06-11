"""
Streaming JSONL parser with mtime-based in-process cache.

Only 'user' and 'assistant' type messages are returned to callers.
All other types (progress, file-history-snapshot, queue-operation, etc.)
are filtered out at read time.
"""
from __future__ import annotations

from pathlib import Path
from typing import Generator

import orjson

RENDERABLE_TYPES = {"user", "assistant"}

# Cache: (str(path), mtime) → list[dict]
_message_cache: dict[tuple[str, float], list[dict]] = {}
_index_cache: dict[tuple[str, float], dict] = {}


def _iter_raw(path: Path) -> Generator[dict, None, None]:
    """Yield raw parsed JSON objects from a JSONL file, skipping malformed lines."""
    with open(path, "rb") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                yield orjson.loads(raw)
            except Exception:
                continue


def get_messages(path: Path) -> list[dict]:
    """Return filtered (user + assistant only) messages from a JSONL file, cached by mtime."""
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return []
    key = (str(path), mtime)
    if key not in _message_cache:
        _message_cache[key] = [
            m for m in _iter_raw(path)
            if m.get("type") in RENDERABLE_TYPES
        ]
        _prune_cache(_message_cache, key)
    return _message_cache[key]


def index_session(path: Path) -> dict:
    """
    Compute lightweight session metadata without loading all messages.
    Returns: {messageCount, lastMessageAt, firstMessageAt, cwd, gitBranch, version, hasSubagents, slug}
    """
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return {}
    key = (str(path), mtime)
    if key not in _index_cache:
        count = 0
        first_ts = last_ts = None
        cwd = git = version = slug = None
        subagent_dir = path.parent / path.stem / "subagents"
        has_subagents = subagent_dir.is_dir() and any(subagent_dir.iterdir())

        for msg in _iter_raw(path):
            if msg.get("type") not in RENDERABLE_TYPES:
                continue
            count += 1
            ts = msg.get("timestamp")
            if ts:
                if first_ts is None or ts < first_ts:
                    first_ts = ts
                if last_ts is None or ts > last_ts:
                    last_ts = ts
            if not cwd:
                cwd = msg.get("cwd")
                git = msg.get("gitBranch")
                version = msg.get("version")
                slug = msg.get("slug")

        _index_cache[key] = {
            "messageCount": count,
            "firstMessageAt": first_ts,
            "lastMessageAt": last_ts,
            "cwd": cwd,
            "gitBranch": git,
            "version": version,
            "slug": slug,
            "hasSubagents": has_subagents,
        }
        _prune_cache(_index_cache, key)
    return _index_cache[key]


def _prune_cache(cache: dict, just_added: tuple) -> None:
    """Keep cache size bounded at 100 entries, removing oldest by insertion order."""
    if len(cache) > 100:
        oldest = next(iter(cache))
        if oldest != just_added:
            del cache[oldest]
