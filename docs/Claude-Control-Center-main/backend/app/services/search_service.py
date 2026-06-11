"""
Global Search over Conversations (Claude Code JSONL) and Memory (project *.md).

Design: docs/adr/0001-global-search-scans-on-demand.md
- On-demand scan per query; no persisted index.
- Lazy in-memory cache of extracted searchable text per file, keyed by mtime.
- Searchable conversation text = text + thinking + tool_use inputs (NOT tool_result / images).
- Keyword AND match, order-independent, case-insensitive.
"""
from __future__ import annotations

import re
from pathlib import Path

import frontmatter
import orjson

from app.config import CLAUDE_DIR
from app.services.jsonl_parser import _iter_raw
from app.services.project_decoder import display_name

# path -> (mtime, payload). payload shape differs for conversation vs memory files.
_conv_cache: dict[str, tuple[float, list[dict]]] = {}
_mem_cache: dict[str, tuple[float, dict]] = {}

_SNIPPET_RADIUS = 90
_MAX_GROUPS = 50
_WS = re.compile(r"\s+")


def _blocks_text(content) -> str:
    """Join searchable text from a message's content: text + thinking + tool_use inputs."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return str(content)

    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            parts.append(str(block))
            continue
        btype = block.get("type")
        if btype == "text":
            parts.append(block.get("text", "") or "")
        elif btype == "thinking":
            parts.append(block.get("thinking", "") or "")
        elif btype == "tool_use":
            name = block.get("name", "") or ""
            inp = block.get("input")
            if inp is not None:
                try:
                    inp_str = orjson.dumps(inp).decode("utf-8")
                except Exception:
                    inp_str = str(inp)
            else:
                inp_str = ""
            parts.append(f"{name} {inp_str}")
        # tool_result, image and everything else are intentionally excluded
    return " ".join(p for p in parts if p)


def _extract_conversation(path: Path) -> list[dict]:
    """Per-message searchable text for one session file."""
    out: list[dict] = []
    for msg in _iter_raw(path):
        if msg.get("type") not in {"user", "assistant"}:
            continue
        inner = msg.get("message", {}) or {}
        text = _blocks_text(inner.get("content"))
        text = _WS.sub(" ", text).strip()
        if not text:
            continue
        out.append({
            "uuid": msg.get("uuid"),
            "timestamp": msg.get("timestamp"),
            "slug": msg.get("slug"),
            "display": text[:20000],
            "search": text[:20000].lower(),
        })
    return out


def _conversation_messages(path: Path) -> list[dict]:
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return []
    cached = _conv_cache.get(str(path))
    if cached is None or cached[0] != mtime:
        _conv_cache[str(path)] = (mtime, _extract_conversation(path))
    return _conv_cache[str(path)][1]


def _extract_memory(path: Path) -> dict:
    try:
        post = frontmatter.load(str(path))
        name = post.metadata.get("name", path.stem)
        desc = post.metadata.get("description", "")
        body = post.content
    except Exception:
        name, desc, body = path.stem, "", path.read_text(encoding="utf-8", errors="ignore")
    display = _WS.sub(" ", f"{name} {desc} {body}").strip()
    return {
        "name": name,
        "description": desc,
        "display": display[:20000],
        "search": display[:20000].lower(),
    }


def _memory_doc(path: Path) -> dict:
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return {}
    cached = _mem_cache.get(str(path))
    if cached is None or cached[0] != mtime:
        _mem_cache[str(path)] = (mtime, _extract_memory(path))
    return _mem_cache[str(path)][1]


def _matches(search: str, tokens: list[str]) -> bool:
    return all(tok in search for tok in tokens)


def _snippet(display: str, tokens: list[str]) -> str:
    """A short context window around the earliest matched token."""
    low = display.lower()
    pos = min((low.find(t) for t in tokens if low.find(t) != -1), default=-1)
    if pos == -1:
        return display[: _SNIPPET_RADIUS * 2].strip()
    start = max(0, pos - _SNIPPET_RADIUS)
    end = min(len(display), pos + _SNIPPET_RADIUS)
    snippet = display[start:end].strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(display):
        snippet = snippet + "…"
    return snippet


def search(query: str) -> dict:
    """Return {conversations: [...], memory: [...]} for an AND keyword query."""
    tokens = [t for t in query.lower().split() if t]
    if not tokens:
        return {"conversations": [], "memory": []}

    projects_dir = CLAUDE_DIR / "projects"

    # --- Conversations: one group per session file ---
    conversations: list[dict] = []
    for path in projects_dir.glob("*/*.jsonl"):
        project_dir = path.parent.name
        messages = _conversation_messages(path)
        match_count = 0
        best = None
        last_ts = None
        slug = None
        for m in messages:
            if m.get("timestamp") and (last_ts is None or m["timestamp"] > last_ts):
                last_ts = m["timestamp"]
            if not slug and m.get("slug"):
                slug = m["slug"]
            if _matches(m["search"], tokens):
                match_count += 1
                if best is None:
                    best = m
        if match_count == 0 or best is None:
            continue
        conversations.append({
            "projectId": project_dir,
            "projectName": display_name(project_dir),
            "sessionId": path.stem,
            "slug": slug,
            "matchCount": match_count,
            "lastMessageAt": last_ts,
            "snippet": _snippet(best["display"], tokens),
            "messageUuid": best["uuid"],
        })

    conversations.sort(key=lambda g: g.get("lastMessageAt") or "", reverse=True)

    # --- Memory: one group per markdown file ---
    memory: list[dict] = []
    for path in projects_dir.glob("*/memory/*.md"):
        if path.name == "MEMORY.md":
            continue
        doc = _memory_doc(path)
        if not doc or not _matches(doc["search"], tokens):
            continue
        project_dir = path.parent.parent.name
        memory.append({
            "projectId": project_dir,
            "projectName": display_name(project_dir),
            "filename": path.name,
            "name": doc["name"],
            "snippet": _snippet(doc["display"], tokens),
        })

    memory.sort(key=lambda g: g["name"].lower())

    return {
        "conversations": conversations[:_MAX_GROUPS],
        "memory": memory[:_MAX_GROUPS],
    }
