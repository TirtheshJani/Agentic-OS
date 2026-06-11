"""
Proxy layer for the external LightRAG server (default: http://localhost:9621).

All RAG insert/query calls go through here instead of the in-process memory_rag_service.
Responsibilities:
  - HTTP proxy to LightRAG REST API
  - Sidecar manifest (source, tags, doc_id metadata not stored by LightRAG itself)
  - Daily insert-count cap (LIGHTRAG_DAILY_INGEST_LIMIT) for cost safety
  - Normalised status dict consumed by the frontend
"""
from __future__ import annotations

import hashlib
import threading
import time
from datetime import datetime, timezone
from typing import Any

import orjson
import urllib.request
import urllib.error

from app.config import (
    LIGHTRAG_DAILY_INGEST_LIMIT,
    LIGHTRAG_SERVER_URL,
    LIGHTRAG_WORKING_DIR,
)

# ---------------------------------------------------------------------------
# Internal state
# ---------------------------------------------------------------------------

_manifest_lock = threading.Lock()
_budget_lock = threading.Lock()

_MANIFEST_PATH = LIGHTRAG_WORKING_DIR / "manifest.jsonl"
_INGEST_BUDGET_PATH = LIGHTRAG_WORKING_DIR / "ingest_budget.json"

_REQUEST_TIMEOUT = 15  # seconds


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _post_json(path: str, payload: dict) -> dict:
    url = f"{LIGHTRAG_SERVER_URL.rstrip('/')}{path}"
    data = orjson.dumps(payload)
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT) as resp:
            return orjson.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            detail = orjson.loads(body).get("detail", body.decode(errors="replace"))
        except Exception:
            detail = body.decode(errors="replace")
        raise RuntimeError(f"LightRAG HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"LightRAG unreachable ({LIGHTRAG_SERVER_URL}): {e.reason}") from e


def _get_json(path: str, params: dict | None = None) -> dict | list:
    qs = ""
    if params:
        pairs = "&".join(f"{k}={v}" for k, v in params.items())
        qs = f"?{pairs}"
    url = f"{LIGHTRAG_SERVER_URL.rstrip('/')}{path}{qs}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT) as resp:
            return orjson.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"LightRAG HTTP {e.code}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"LightRAG unreachable ({LIGHTRAG_SERVER_URL}): {e.reason}") from e


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

def get_status() -> dict[str, Any]:
    """Return normalised status compatible with the existing frontend RagStatus shape."""
    try:
        health = _get_json("/health")
        server_status = health.get("status", "unknown")
        config = health.get("configuration", {})
        llm_ok = (
            server_status == "healthy"
            and "sk-REPLA" not in str(config.get("llm_binding_host", ""))
        )
        # Warn when the placeholder key is still in use
        placeholder = "sk-REPLA*E_ME" in str(config) or "REPLA*E_ME" in str(config)
        return {
            "status": "ready" if llm_ok and not placeholder else "misconfigured",
            "error": "LightRAG server has placeholder LLM API key — configure a real key" if placeholder else "",
            "server_url": LIGHTRAG_SERVER_URL,
            "server_status": server_status,
            "core_version": health.get("core_version", ""),
            "api_version": health.get("api_version", ""),
            "pipeline_busy": health.get("pipeline_busy", False),
            "llm_model": config.get("llm_model", ""),
            "llm_binding": config.get("llm_binding", ""),
            "embedding_model": config.get("embedding_model", ""),
            "budget": _budget_snapshot(),
            # Legacy shape fields expected by some frontend components
            "started_at": None,
            "ready_at": None,
            "model": config.get("llm_model", ""),
            "embedding_dim": None,
            "working_dir": config.get("working_directory", ""),
        }
    except RuntimeError as e:
        return {
            "status": "error",
            "error": str(e),
            "server_url": LIGHTRAG_SERVER_URL,
            "budget": _budget_snapshot(),
            "started_at": None,
            "ready_at": None,
            "model": "",
            "embedding_dim": None,
            "working_dir": "",
        }


# ---------------------------------------------------------------------------
# Daily insert budget (document count, not token count)
# ---------------------------------------------------------------------------

def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _load_budget() -> dict[str, Any]:
    if not _INGEST_BUDGET_PATH.exists():
        return {"day": _today_utc(), "inserts": 0}
    try:
        data = orjson.loads(_INGEST_BUDGET_PATH.read_bytes())
    except Exception:
        return {"day": _today_utc(), "inserts": 0}
    if data.get("day") != _today_utc():
        return {"day": _today_utc(), "inserts": 0}
    return data


def _save_budget(b: dict) -> None:
    LIGHTRAG_WORKING_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _INGEST_BUDGET_PATH.with_suffix(".tmp")
    tmp.write_bytes(orjson.dumps(b))
    tmp.replace(_INGEST_BUDGET_PATH)


def _budget_snapshot() -> dict[str, Any]:
    with _budget_lock:
        b = _load_budget()
    return {
        "day": b["day"],
        "inserts": b["inserts"],
        "cap": LIGHTRAG_DAILY_INGEST_LIMIT,
        "remaining": max(0, LIGHTRAG_DAILY_INGEST_LIMIT - b["inserts"]),
        # Legacy fields (the frontend budget widget expects these)
        "spent_usd": 0.0,
        "cap_usd": 0.0,
        "remaining_usd": 0.0,
        "input_tokens": 0,
        "output_tokens": 0,
    }


def _check_and_record_insert() -> None:
    with _budget_lock:
        b = _load_budget()
        if b["inserts"] >= LIGHTRAG_DAILY_INGEST_LIMIT:
            raise RuntimeError(
                f"lightrag_proxy: daily insert limit reached "
                f"({b['inserts']}/{LIGHTRAG_DAILY_INGEST_LIMIT})"
            )
        b["inserts"] += 1
        _save_budget(b)


# ---------------------------------------------------------------------------
# Manifest sidecar
# ---------------------------------------------------------------------------

def _manifest_append(entry: dict) -> None:
    LIGHTRAG_WORKING_DIR.mkdir(parents=True, exist_ok=True)
    line = orjson.dumps(entry) + b"\n"
    with _manifest_lock:
        with open(_MANIFEST_PATH, "ab") as f:
            f.write(line)


def _manifest_read(filters: dict | None = None) -> list[dict]:
    if not _MANIFEST_PATH.exists():
        return []
    out: list[dict] = []
    with _manifest_lock:
        with open(_MANIFEST_PATH, "rb") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = orjson.loads(line)
                except Exception:
                    continue
                if filters:
                    src = filters.get("source")
                    if src and entry.get("source") != src:
                        continue
                    tag = filters.get("tag")
                    if tag and tag not in (entry.get("tags") or []):
                        continue
                out.append(entry)
    return out


# ---------------------------------------------------------------------------
# Public API (mirrors memory_rag_service interface)
# ---------------------------------------------------------------------------

def insert(
    content: str,
    source: str = "manual",
    tags: list[str] | None = None,
    doc_id: str | None = None,
) -> dict[str, Any]:
    if not content or not content.strip():
        raise ValueError("content is required")

    _check_and_record_insert()

    if doc_id is None:
        doc_id = hashlib.sha1(content[:512].encode()).hexdigest()[:16] + f"-{int(time.time())}"

    file_source = f"source:{source}"
    if tags:
        file_source += " tags:" + ",".join(tags)

    _post_json("/documents/text", {"text": content, "file_source": file_source})

    entry = {
        "doc_id": doc_id,
        "source": source,
        "tags": tags or [],
        "chars": len(content),
        "inserted_at": datetime.now(timezone.utc).isoformat(),
    }
    _manifest_append(entry)
    return entry


def query(text: str, mode: str = "hybrid", top_k: int = 10) -> dict[str, Any]:
    if not text or not text.strip():
        raise ValueError("query text is required")
    valid_modes = {"naive", "local", "global", "hybrid", "mix", "bypass"}
    if mode not in valid_modes:
        raise ValueError(f"invalid mode: {mode}")

    resp = _post_json("/query", {"query": text, "mode": mode, "top_k": top_k})
    return {
        "query": text,
        "mode": mode,
        "top_k": top_k,
        "answer": resp.get("response", ""),
        "references": resp.get("references", []),
        # Legacy key used by existing frontend
        "result": resp.get("response", ""),
    }


def list_docs(filters: dict | None = None) -> list[dict]:
    """Return docs from the sidecar manifest (metadata) merged with live status from :9621."""
    manifest_entries = _manifest_read(filters)
    return manifest_entries


def list_docs_live(page: int = 1, page_size: int = 50) -> dict[str, Any]:
    """Return raw document status list directly from the LightRAG server."""
    try:
        data = _get_json(
            "/documents/paginated",
            {"page": page, "page_size": page_size},
        )
        return {"docs": data, "source": "server"}
    except RuntimeError as e:
        return {"error": str(e), "docs": [], "source": "server"}


def get_doc_status_counts() -> dict[str, Any]:
    try:
        return _get_json("/documents/status_counts")
    except RuntimeError as e:
        return {"error": str(e)}
