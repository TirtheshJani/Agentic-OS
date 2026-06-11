"""
Background scanner that auto-ingests Claude Code, Codex, and Antigravity session
content into the external LightRAG server.

Strategy:
  - Runs every LIGHTRAG_INGEST_INTERVAL seconds in a daemon thread.
  - Tracks which files have been ingested via a fingerprint store
    (backend/data/ingest_state.json) keyed by path+mtime.
  - Respects the daily insert-count cap from lightrag_proxy_service.
  - Extracts a compact summary from each source type rather than ingesting
    entire raw JSONL dumps.
"""
from __future__ import annotations

import hashlib
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import orjson

from app.config import (
    ANTIGRAVITY_DIR,
    CLAUDE_DIR,
    CODEX_DIR,
    LIGHTRAG_INGEST_INTERVAL,
    LIGHTRAG_WORKING_DIR,
)

# ---------------------------------------------------------------------------
# State persistence
# ---------------------------------------------------------------------------

_STATE_PATH = LIGHTRAG_WORKING_DIR / "ingest_state.json"
_LOG_PATH = LIGHTRAG_WORKING_DIR / "ingest_log.jsonl"
_state_lock = threading.Lock()
_log_lock = threading.Lock()

# In-memory log (last 200 entries)
_recent_log: list[dict] = []
_LOG_MAX = 200

# Scan status for the UI
_scan_state: dict[str, Any] = {
    "status": "idle",
    "last_scan_at": None,
    "next_scan_at": None,
    "total_ingested": 0,
    "last_run_ingested": 0,
    "last_error": "",
    "sources": {
        "claude_code": {"scanned": 0, "ingested": 0},
        "codex": {"scanned": 0, "ingested": 0},
        "antigravity": {"scanned": 0, "ingested": 0},
    },
}
_scan_lock = threading.Lock()
_scan_thread: threading.Thread | None = None
_manual_trigger = threading.Event()


# ---------------------------------------------------------------------------
# Fingerprint store
# ---------------------------------------------------------------------------

def _load_state() -> dict[str, str]:
    if not _STATE_PATH.exists():
        return {}
    try:
        return orjson.loads(_STATE_PATH.read_bytes())
    except Exception:
        return {}


def _save_state(state: dict) -> None:
    LIGHTRAG_WORKING_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _STATE_PATH.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(state))
    tmp.replace(_STATE_PATH)


def _fingerprint(path: Path) -> str:
    try:
        mtime = path.stat().st_mtime
        return f"{path}:{mtime}"
    except Exception:
        return str(path)


# ---------------------------------------------------------------------------
# Log helpers
# ---------------------------------------------------------------------------

def _log(action: str, source: str, path: str, detail: str = "") -> None:
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "source": source,
        "path": path,
        "detail": detail,
    }
    with _log_lock:
        _recent_log.append(entry)
        if len(_recent_log) > _LOG_MAX:
            _recent_log.pop(0)
        try:
            with open(_LOG_PATH, "ab") as f:
                f.write(orjson.dumps(entry) + b"\n")
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Content extractors
# ---------------------------------------------------------------------------

def _extract_claude_code_summary(path: Path) -> str | None:
    """Extract a compact summary from a Claude Code JSONL conversation file."""
    try:
        messages: list[dict] = []
        with open(path, "rb") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = orjson.loads(line)
                except Exception:
                    continue
                if obj.get("type") in {"user", "assistant"}:
                    messages.append(obj)
    except Exception:
        return None

    if not messages:
        return None

    # Extract first user message and up to 3 assistant text blocks
    parts: list[str] = []
    user_count = 0
    assistant_count = 0

    for msg in messages:
        msg_type = msg.get("type")
        if msg_type == "user" and user_count < 2:
            content = msg.get("message", {})
            if isinstance(content, dict):
                for block in content.get("content", []):
                    if isinstance(block, dict) and block.get("type") == "text":
                        text = block.get("text", "").strip()
                        if text:
                            parts.append(f"User: {text[:800]}")
                            user_count += 1
                            break
            elif isinstance(content, str):
                parts.append(f"User: {content[:800]}")
                user_count += 1
        elif msg_type == "assistant" and assistant_count < 2:
            content = msg.get("message", {})
            if isinstance(content, dict):
                for block in content.get("content", []):
                    if isinstance(block, dict) and block.get("type") == "text":
                        text = block.get("text", "").strip()
                        if text:
                            parts.append(f"Assistant: {text[:800]}")
                            assistant_count += 1
                            break

    if not parts:
        return None

    # Add source metadata
    cwd = ""
    for msg in messages[:5]:
        cwd = msg.get("cwd", "")
        if cwd:
            break

    header = f"[Claude Code Session]\nFile: {path.name}"
    if cwd:
        header += f"\nProject: {cwd}"
    header += f"\nMessages: {len(messages)}\n\n"

    return header + "\n\n".join(parts)


def _extract_codex_summary(records: list[dict]) -> str | None:
    """Summarise a batch of Codex history records."""
    if not records:
        return None
    lines = []
    for r in records[:30]:
        text = (r.get("text") or "").strip()
        if text and len(text) > 5:
            lines.append(text[:500])
    if not lines:
        return None
    ts_first = records[0].get("ts", 0)
    try:
        dt = datetime.fromtimestamp(ts_first, tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        dt = "unknown"
    header = f"[Codex Session — {dt}]\n"
    return header + "\n".join(lines)


def _extract_antigravity_file(path: Path) -> str | None:
    """Read an Antigravity knowledge file verbatim (they're already structured notes)."""
    try:
        text = path.read_text(errors="replace").strip()
        if not text:
            return None
        return f"[Antigravity Knowledge: {path.name}]\n\n{text[:8000]}"
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Scan runners
# ---------------------------------------------------------------------------

def _scan_claude_code(state: dict, ingested_count: list[int], limit: int) -> dict:
    stats = {"scanned": 0, "ingested": 0}
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.exists():
        return stats

    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        conv_dir = project_dir
        for jsonl_file in conv_dir.glob("*.jsonl"):
            if ingested_count[0] >= limit:
                return stats
            stats["scanned"] += 1
            fp = _fingerprint(jsonl_file)
            if state.get(str(jsonl_file)) == fp:
                continue
            summary = _extract_claude_code_summary(jsonl_file)
            if not summary:
                state[str(jsonl_file)] = fp
                continue
            try:
                from app.services import lightrag_proxy_service as proxy
                proxy.insert(
                    summary,
                    source="claude-code",
                    tags=["session", "claude-code", project_dir.name],
                    doc_id=f"cc-{hashlib.sha1(str(jsonl_file).encode()).hexdigest()[:12]}",
                )
                state[str(jsonl_file)] = fp
                stats["ingested"] += 1
                ingested_count[0] += 1
                _log("ingested", "claude-code", str(jsonl_file))
            except RuntimeError as e:
                _log("error", "claude-code", str(jsonl_file), str(e))
                if "limit" in str(e).lower():
                    return stats
    return stats


def _scan_codex(state: dict, ingested_count: list[int], limit: int) -> dict:
    stats = {"scanned": 0, "ingested": 0}
    history_file = CODEX_DIR / "history.jsonl"
    if not history_file.exists():
        return stats

    fp = _fingerprint(history_file)
    if state.get(str(history_file)) == fp:
        return stats

    stats["scanned"] += 1
    if ingested_count[0] >= limit:
        return stats

    try:
        records: list[dict] = []
        with open(history_file, "rb") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(orjson.loads(line))
                    except Exception:
                        pass

        summary = _extract_codex_summary(records)
        if not summary:
            state[str(history_file)] = fp
            return stats

        from app.services import lightrag_proxy_service as proxy
        proxy.insert(
            summary,
            source="codex",
            tags=["session", "codex"],
            doc_id=f"codex-history-{fp[-8:]}",
        )
        state[str(history_file)] = fp
        stats["ingested"] += 1
        ingested_count[0] += 1
        _log("ingested", "codex", str(history_file))
    except RuntimeError as e:
        _log("error", "codex", str(history_file), str(e))
    return stats


def _scan_antigravity(state: dict, ingested_count: list[int], limit: int) -> dict:
    stats = {"scanned": 0, "ingested": 0}
    knowledge_dir = ANTIGRAVITY_DIR / "knowledge"
    if not knowledge_dir.exists():
        return stats

    for kfile in knowledge_dir.rglob("*"):
        if not kfile.is_file():
            continue
        if ingested_count[0] >= limit:
            return stats
        stats["scanned"] += 1
        fp = _fingerprint(kfile)
        if state.get(str(kfile)) == fp:
            continue
        text = _extract_antigravity_file(kfile)
        if not text:
            state[str(kfile)] = fp
            continue
        try:
            from app.services import lightrag_proxy_service as proxy
            proxy.insert(
                text,
                source="antigravity",
                tags=["knowledge", "antigravity", kfile.suffix.lstrip(".")],
                doc_id=f"ag-{hashlib.sha1(str(kfile).encode()).hexdigest()[:12]}",
            )
            state[str(kfile)] = fp
            stats["ingested"] += 1
            ingested_count[0] += 1
            _log("ingested", "antigravity", str(kfile))
        except RuntimeError as e:
            _log("error", "antigravity", str(kfile), str(e))
            if "limit" in str(e).lower():
                return stats
    return stats


# ---------------------------------------------------------------------------
# Main scan loop
# ---------------------------------------------------------------------------

def _run_scan() -> None:
    from app.config import LIGHTRAG_DAILY_INGEST_LIMIT
    limit = LIGHTRAG_DAILY_INGEST_LIMIT

    with _scan_lock:
        _scan_state["status"] = "scanning"
        _scan_state["last_error"] = ""

    state = _load_state()
    ingested_count = [0]

    try:
        cc_stats = _scan_claude_code(state, ingested_count, limit)
        codex_stats = _scan_codex(state, ingested_count, limit)
        ag_stats = _scan_antigravity(state, ingested_count, limit)
        _save_state(state)

        with _scan_lock:
            _scan_state["last_scan_at"] = datetime.now(timezone.utc).isoformat()
            _scan_state["last_run_ingested"] = ingested_count[0]
            _scan_state["total_ingested"] = (
                _scan_state.get("total_ingested", 0) + ingested_count[0]
            )
            _scan_state["sources"]["claude_code"] = cc_stats
            _scan_state["sources"]["codex"] = codex_stats
            _scan_state["sources"]["antigravity"] = ag_stats
            _scan_state["status"] = "idle"
    except Exception as e:
        with _scan_lock:
            _scan_state["status"] = "error"
            _scan_state["last_error"] = str(e)
        _log("error", "scanner", "", str(e))


def _loop() -> None:
    while True:
        _run_scan()
        with _scan_lock:
            _scan_state["next_scan_at"] = datetime.fromtimestamp(
                time.time() + LIGHTRAG_INGEST_INTERVAL, tz=timezone.utc
            ).isoformat()
        # Sleep in short chunks so manual trigger is responsive
        deadline = time.monotonic() + LIGHTRAG_INGEST_INTERVAL
        while time.monotonic() < deadline:
            if _manual_trigger.wait(timeout=5.0):
                _manual_trigger.clear()
                break


def scan_all_background() -> None:
    """Start the ingest scanner daemon thread. Idempotent."""
    global _scan_thread
    if _scan_thread is not None and _scan_thread.is_alive():
        return
    _scan_thread = threading.Thread(target=_loop, name="lightrag-ingest", daemon=True)
    _scan_thread.start()


def trigger_scan() -> None:
    """Ask the background loop to run a scan immediately."""
    _manual_trigger.set()


# ---------------------------------------------------------------------------
# Public accessors
# ---------------------------------------------------------------------------

def get_status() -> dict[str, Any]:
    with _scan_lock:
        return dict(_scan_state)


def get_log(limit: int = 50) -> list[dict]:
    with _log_lock:
        return list(_recent_log[-limit:])
