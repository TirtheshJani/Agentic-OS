from __future__ import annotations

"""Background scanner: ingest Claude Code JSONL conversations into shared RAG."""

import hashlib
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import orjson

from app.config import ANTHROPIC_API_KEY, CLAUDE_DIR

logger = logging.getLogger(__name__)

_DATA_FILE = Path(__file__).parent.parent.parent / "data" / "conv_ingest_state.json"
_SCAN_INTERVAL = 300  # 5 minutes
_LAST_N_DAYS = 30
_CHUNK_SIZE = 1000  # chars per RAG chunk

_state_lock = threading.Lock()
_started = False
_start_lock = threading.Lock()


def _load_seen() -> set[str]:
    """Load seen set from state file. Returns set of hash strings."""
    if not _DATA_FILE.exists():
        return set()
    try:
        data = orjson.loads(_DATA_FILE.read_bytes())
        return set(data.get("seen", []))
    except Exception:
        return set()


def _save_seen(seen: set[str]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _DATA_FILE.with_suffix(".tmp")
    with _state_lock:
        tmp.write_bytes(orjson.dumps({"seen": sorted(seen)}, option=orjson.OPT_INDENT_2))
        os.replace(tmp, _DATA_FILE)


def _msg_hash(session_id: str, message_id: str) -> str:
    return hashlib.sha256(f"{session_id}:{message_id}".encode()).hexdigest()[:24]


def _extract_text(message: dict) -> str:
    """Extract plain text from a message content block."""
    content = message.get("message", {}).get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return " ".join(parts)
    return ""


def _chunk(text: str, size: int = _CHUNK_SIZE) -> list[str]:
    chunks = []
    for i in range(0, len(text), size):
        chunk = text[i:i + size].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def _scan_once(seen: set[str]) -> set[str]:
    """Walk JSONL files, ingest unseen messages. Returns updated seen set."""
    projects_dir = CLAUDE_DIR / "projects"
    if not projects_dir.exists():
        return seen

    cutoff = datetime.now(timezone.utc) - timedelta(days=_LAST_N_DAYS)
    new_seen = set(seen)

    try:
        from app.services import memory_rag_service
        rag_status = memory_rag_service.get_status().get("status", "")
        if rag_status != "ready":
            return seen
    except Exception:
        return seen

    for jsonl_file in projects_dir.rglob("*.jsonl"):
        try:
            mtime = datetime.fromtimestamp(jsonl_file.stat().st_mtime, tz=timezone.utc)
        except Exception:
            continue
        if mtime < cutoff:
            continue

        session_id = jsonl_file.stem
        try:
            raw_lines = jsonl_file.read_bytes().splitlines()
        except Exception:
            continue

        for raw in raw_lines:
            raw = raw.strip()
            if not raw:
                continue
            try:
                record = orjson.loads(raw)
            except Exception:
                continue

            rtype = record.get("type")
            if rtype not in ("user", "assistant"):
                continue

            message_id = record.get("uuid") or record.get("message", {}).get("id", "")
            if not message_id:
                continue

            key = _msg_hash(session_id, str(message_id))
            if key in new_seen:
                continue

            # Skip tool_use and tool_result blocks
            msg_content = record.get("message", {}).get("content", "")
            if isinstance(msg_content, list):
                block_types = {b.get("type") for b in msg_content if isinstance(b, dict)}
                if block_types <= {"tool_use", "tool_result"}:
                    continue

            text = _extract_text(record)
            if not text.strip():
                new_seen.add(key)
                continue

            for chunk in _chunk(text):
                try:
                    memory_rag_service.insert(
                        chunk,
                        source=f"conv:{session_id}",
                        tags=["conversation"],
                    )
                except Exception as exc:
                    # Budget exhausted or not ready — stop processing
                    logger.debug("conversation_ingest_scanner: insert stopped: %s", exc)
                    _save_seen(new_seen)
                    return new_seen

            new_seen.add(key)

    _save_seen(new_seen)
    return new_seen


def _worker() -> None:
    time.sleep(30)  # let startup settle
    seen = _load_seen()
    while True:
        try:
            if ANTHROPIC_API_KEY:
                seen = _scan_once(seen)
        except Exception as exc:
            logger.exception("conversation_ingest_scanner: error: %s", exc)
        time.sleep(_SCAN_INTERVAL)


def start_background_scan() -> None:
    """Launch the background scan daemon. Idempotent."""
    global _started
    with _start_lock:
        if _started:
            return
        _started = True
    t = threading.Thread(target=_worker, daemon=True, name="conv-ingest-scan")
    t.start()
    logger.info("conversation_ingest_scanner: started")
