"""
LightRAG-backed shared memory for the Agentic OS (facade).

Wraps HKUDS/LightRAG (knowledge graph + vector hybrid) with:
- Lazy background init so Flask boot stays fast.
- Anthropic Haiku LLM adapter for entity/relationship extraction.
- Local sentence-transformers embeddings (no per-chunk API spend).
- Daily USD budget guard with persisted accounting (``memory_rag_budget``).
- Sidecar manifest for list-documents (``memory_rag_manifest``).
- Graceful degradation: if deps aren't installed, status reports `not_installed`
  and read/write functions raise RuntimeError; routes translate to 503.

:class:`MemoryRagService` holds all state on the instance with constructor-injected
``working_dir`` / ``budget_cap`` / ``clock``; the process-wide singleton returned
by :func:`get_memory_rag_service` preserves the "one event loop, owned forever"
invariant. Module-level functions delegate to it for back-compat.
"""
from __future__ import annotations

import asyncio
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from app.config import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_HAIKU_MODEL,
    EMBEDDING_DIM,
    EMBEDDING_MODEL_NAME,
    LIGHTRAG_WORKING_DIR,
    MEMORY_DAILY_BUDGET_USD,
)
from app.services import memory_rag_budget, memory_rag_manifest

# ---------------------------------------------------------------------------
# Status constants
# ---------------------------------------------------------------------------

_STATUS_NOT_STARTED = "not_started"
_STATUS_INITIALIZING = "initializing"
_STATUS_READY = "ready"
_STATUS_ERROR = "error"
_STATUS_NOT_INSTALLED = "not_installed"
_STATUS_BUDGET_EXHAUSTED = "budget_exhausted"
_STATUS_NO_API_KEY = "no_api_key"

Clock = Callable[[], datetime]


class MemoryRagService:
    """LightRAG wrapper with injectable working dir, budget cap, and clock."""

    def __init__(
        self,
        *,
        working_dir: Path | str | None = None,
        api_key: str | None = None,
        haiku_model: str | None = None,
        embedding_model: str | None = None,
        embedding_dim: int | None = None,
        budget_cap: float | None = None,
        clock: Clock | None = None,
    ) -> None:
        self._working_dir = Path(working_dir) if working_dir is not None else Path(LIGHTRAG_WORKING_DIR)
        self._api_key = api_key if api_key is not None else ANTHROPIC_API_KEY
        self._haiku_model = haiku_model or ANTHROPIC_HAIKU_MODEL
        self._embedding_model = embedding_model or EMBEDDING_MODEL_NAME
        self._embedding_dim = embedding_dim if embedding_dim is not None else EMBEDDING_DIM
        self._budget_cap = budget_cap if budget_cap is not None else MEMORY_DAILY_BUDGET_USD
        self._clock = clock or (lambda: datetime.now(timezone.utc))

        self._state_lock = threading.Lock()
        self._state: dict[str, Any] = {
            "status": _STATUS_NOT_STARTED,
            "error": "",
            "started_at": None,
            "ready_at": None,
        }

        self._rag: Any = None
        self._embedder: Any = None
        self._init_event = threading.Event()
        self._init_thread: threading.Thread | None = None

        self._loop: asyncio.AbstractEventLoop | None = None
        self._loop_thread: threading.Thread | None = None
        self._loop_lock = threading.Lock()

        self._manifest_path = self._working_dir / "manifest.jsonl"
        self._budget_path = self._working_dir / "budget.json"
        self._manifest_lock = threading.Lock()
        self._budget_lock = threading.Lock()

    # --- status ------------------------------------------------------------

    def _set_status(self, status: str, error: str = "") -> None:
        with self._state_lock:
            self._state["status"] = status
            self._state["error"] = error
            if status == _STATUS_INITIALIZING and self._state["started_at"] is None:
                self._state["started_at"] = self._clock().isoformat()
            if status == _STATUS_READY:
                self._state["ready_at"] = self._clock().isoformat()

    def get_status(self) -> dict[str, Any]:
        """Public status snapshot. Safe to call before init."""
        self.reset_status_if_new_day()
        with self._state_lock:
            snapshot = dict(self._state)
        snapshot["budget"] = self._budget_snapshot()
        snapshot["model"] = self._haiku_model
        snapshot["embedding_model"] = self._embedding_model
        snapshot["embedding_dim"] = self._embedding_dim
        snapshot["working_dir"] = str(self._working_dir)
        return snapshot

    def _require_ready(self) -> None:
        status = self._state["status"]
        if status == _STATUS_READY:
            return
        if status == _STATUS_BUDGET_EXHAUSTED:
            raise RuntimeError("memory_rag: daily budget exhausted")
        if status == _STATUS_NOT_INSTALLED:
            raise RuntimeError("memory_rag: lightrag-hku / sentence-transformers not installed")
        if status == _STATUS_NO_API_KEY:
            raise RuntimeError("memory_rag: ANTHROPIC_API_KEY not configured")
        if status == _STATUS_ERROR:
            raise RuntimeError(f"memory_rag: init error: {self._state['error']}")
        raise RuntimeError(f"memory_rag: not ready (status={status})")

    # --- budget ------------------------------------------------------------

    def _budget_snapshot(self) -> dict[str, Any]:
        with self._budget_lock:
            b = memory_rag_budget.load_budget(self._budget_path, self._clock)
        b["cap_usd"] = self._budget_cap
        b["remaining_usd"] = max(0.0, self._budget_cap - b["spent_usd"])
        return b

    def _check_budget(self) -> None:
        """Raise if today's spend is at/above cap; flip status to budget_exhausted."""
        with self._budget_lock:
            b = memory_rag_budget.load_budget(self._budget_path, self._clock)
            if b["spent_usd"] >= self._budget_cap:
                self._set_status(_STATUS_BUDGET_EXHAUSTED)
                raise RuntimeError(
                    f"memory_rag: daily budget exhausted "
                    f"(${b['spent_usd']:.4f} >= ${self._budget_cap:.2f})"
                )

    def _record_spend(self, input_tokens: int, output_tokens: int) -> None:
        cost = memory_rag_budget.cost_usd(input_tokens, output_tokens)
        with self._budget_lock:
            b = memory_rag_budget.load_budget(self._budget_path, self._clock)
            b["spent_usd"] = round(b["spent_usd"] + cost, 6)
            b["input_tokens"] = int(b.get("input_tokens", 0)) + input_tokens
            b["output_tokens"] = int(b.get("output_tokens", 0)) + output_tokens
            memory_rag_budget.save_budget(self._budget_path, b)
            if b["spent_usd"] >= self._budget_cap:
                self._set_status(_STATUS_BUDGET_EXHAUSTED)

    def reset_status_if_new_day(self) -> None:
        """Clear budget_exhausted status if the UTC day has rolled over."""
        with self._state_lock:
            if self._state["status"] != _STATUS_BUDGET_EXHAUSTED:
                return
        with self._budget_lock:
            b = memory_rag_budget.load_budget(self._budget_path, self._clock)
        if b["day"] == memory_rag_budget.today_utc(self._clock) and b["spent_usd"] >= self._budget_cap:
            return
        if self._rag is not None:
            self._set_status(_STATUS_READY)

    # --- async adapters ----------------------------------------------------

    async def _anthropic_llm_func(
        self,
        prompt: str,
        system_prompt: str | None = None,
        history_messages: list[dict[str, str]] | None = None,
        **kwargs: Any,
    ) -> str:
        """Async LLM function with LightRAG's expected signature."""
        self._check_budget()

        from anthropic import AsyncAnthropic  # local import — fail at runtime, not import time

        messages: list[dict[str, str]] = []
        for msg in history_messages or []:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})

        client = AsyncAnthropic(api_key=self._api_key)
        try:
            resp = await client.messages.create(
                model=self._haiku_model,
                max_tokens=kwargs.get("max_tokens", 4096),
                system=system_prompt or "",
                messages=messages,
            )
        finally:
            await client.close()

        usage = getattr(resp, "usage", None)
        if usage:
            self._record_spend(
                input_tokens=getattr(usage, "input_tokens", 0),
                output_tokens=getattr(usage, "output_tokens", 0),
            )

        parts = []
        for block in resp.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "".join(parts)

    async def _embed_func(self, texts: list[str]):
        """Async wrapper over the sentence-transformers encoder."""
        if self._embedder is None:
            raise RuntimeError("memory_rag: embedder not initialized")
        return await asyncio.to_thread(
            lambda: self._embedder.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        )

    # --- init / event loop -------------------------------------------------

    def _init_blocking(self) -> None:
        """Synchronous initializer; runs in a background daemon thread."""
        try:
            if not self._api_key:
                self._set_status(_STATUS_NO_API_KEY)
                return

            self._set_status(_STATUS_INITIALIZING)
            self._working_dir.mkdir(parents=True, exist_ok=True)

            # Heavy imports happen here, not at module load.
            try:
                from lightrag import LightRAG  # type: ignore
                from lightrag.utils import EmbeddingFunc  # type: ignore
                from sentence_transformers import SentenceTransformer  # type: ignore
            except ImportError as e:
                self._set_status(_STATUS_NOT_INSTALLED, f"missing dependency: {e}")
                return

            self._embedder = SentenceTransformer(self._embedding_model)

            self._rag = LightRAG(
                working_dir=str(self._working_dir),
                llm_model_func=self._anthropic_llm_func,
                embedding_func=EmbeddingFunc(
                    embedding_dim=self._embedding_dim,
                    max_token_size=8192,
                    func=self._embed_func,
                ),
            )

            # LightRAG >= 1.3 requires explicit async storage init.
            self._run_async(self._maybe_initialize_storages())

            self._init_event.set()
            self._set_status(_STATUS_READY)
        except Exception as e:
            self._set_status(_STATUS_ERROR, f"{type(e).__name__}: {e}")

    async def _maybe_initialize_storages(self) -> None:
        if self._rag is None:
            return
        init_storages = getattr(self._rag, "initialize_storages", None)
        if init_storages is not None:
            await init_storages()
        # initialize_pipeline_status lives at lightrag.kg.shared_storage (module-level
        # coroutine), not on the LightRAG instance. Safe to skip on versions that lack it.
        try:
            from lightrag.kg.shared_storage import initialize_pipeline_status  # type: ignore
            await initialize_pipeline_status()
        except (ImportError, Exception):
            pass

    def _ensure_loop(self) -> asyncio.AbstractEventLoop:
        """Lazily start the long-lived event loop thread. Returns the running loop."""
        with self._loop_lock:
            if self._loop is not None and self._loop.is_running():
                return self._loop
            loop = asyncio.new_event_loop()
            ready = threading.Event()

            def _run() -> None:
                asyncio.set_event_loop(loop)
                ready.set()
                try:
                    loop.run_forever()
                finally:
                    try:
                        loop.close()
                    except Exception:
                        pass

            t = threading.Thread(target=_run, name="memory-rag-loop", daemon=True)
            t.start()
            ready.wait(timeout=5.0)
            self._loop = loop
            self._loop_thread = t
            return loop

    def _run_async(self, coro):
        """Submit a coroutine to the persistent loop and block until it returns."""
        loop = self._ensure_loop()
        future = asyncio.run_coroutine_threadsafe(coro, loop)
        return future.result()

    def start_background_init(self) -> None:
        """Kick off lazy initialization in a daemon thread. Idempotent."""
        with self._state_lock:
            if self._init_thread is not None and self._init_thread.is_alive():
                return
            if self._state["status"] == _STATUS_READY:
                return
            self._init_thread = threading.Thread(
                target=self._init_blocking, name="memory-rag-init", daemon=True
            )
            self._init_thread.start()

    # --- public CRUD -------------------------------------------------------

    def insert(self, content: str, source: str = "manual", tags: list[str] | None = None, doc_id: str | None = None) -> dict[str, Any]:
        """Insert a chunk of text into the RAG. Charges the daily budget."""
        self._require_ready()
        if not content or not content.strip():
            raise ValueError("content is required")

        if doc_id is None:
            doc_id = f"{source}-{int(time.time() * 1000)}"

        self._run_async(self._rag.ainsert(content, ids=[doc_id]))

        entry = {
            "doc_id": doc_id,
            "source": source,
            "tags": tags or [],
            "chars": len(content),
            "inserted_at": self._clock().isoformat(),
        }
        memory_rag_manifest.append(self._manifest_path, entry, self._manifest_lock)
        return entry

    def query(self, text: str, mode: str = "hybrid", top_k: int = 10) -> dict[str, Any]:
        """Query the RAG. `mode` is one of: naive | local | global | hybrid | mix."""
        self._require_ready()
        if not text or not text.strip():
            raise ValueError("query text is required")
        if mode not in {"naive", "local", "global", "hybrid", "mix"}:
            raise ValueError(f"invalid mode: {mode}")

        from lightrag import QueryParam  # type: ignore

        param = QueryParam(mode=mode, top_k=top_k)
        answer = self._run_async(self._rag.aquery(text, param=param))

        return {"query": text, "mode": mode, "top_k": top_k, "answer": answer}

    def list_docs(self, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """List inserted documents from the sidecar manifest. Safe before ready."""
        return memory_rag_manifest.read(self._manifest_path, self._manifest_lock, filters)


# ---------------------------------------------------------------------------
# Default instance + module-level shims (back-compat surface)
# ---------------------------------------------------------------------------

_default: MemoryRagService | None = None
_default_lock = threading.Lock()


def get_memory_rag_service() -> MemoryRagService:
    """Return the process-wide default MemoryRagService (lazily created)."""
    global _default
    if _default is None:
        with _default_lock:
            if _default is None:
                _default = MemoryRagService()
    return _default


def get_status() -> dict[str, Any]:
    return get_memory_rag_service().get_status()


def insert(content: str, source: str = "manual", tags: list[str] | None = None, doc_id: str | None = None) -> dict[str, Any]:
    return get_memory_rag_service().insert(content, source=source, tags=tags, doc_id=doc_id)


def query(text: str, mode: str = "hybrid", top_k: int = 10) -> dict[str, Any]:
    return get_memory_rag_service().query(text, mode=mode, top_k=top_k)


def list_docs(filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return get_memory_rag_service().list_docs(filters)


def reset_status_if_new_day() -> None:
    get_memory_rag_service().reset_status_if_new_day()


def start_background_init() -> None:
    get_memory_rag_service().start_background_init()
