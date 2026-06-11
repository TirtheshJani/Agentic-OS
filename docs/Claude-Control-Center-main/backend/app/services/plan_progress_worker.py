from __future__ import annotations

"""Background daemon: drains plan_events.jsonl and judges step completion via Haiku."""

import json
import logging
import threading
import time
from pathlib import Path

from app.config import ANTHROPIC_API_KEY, ANTHROPIC_HAIKU_MODEL, CLAUDE_DIR
from app.services import plan_archive_service, plan_event_queue, plan_progress_service
from app.services.plan_step_parser import parse_steps

logger = logging.getLogger(__name__)

_WORKER_INTERVAL = 30  # seconds between drain cycles
_CONFIDENCE_THRESHOLD = 0.75
_started = False
_start_lock = threading.Lock()


def _plans_dir() -> Path:
    return CLAUDE_DIR / "plans"


def _open_plans() -> dict[str, list[dict]]:
    """Return {slug: [step_dicts]} for all active (non-completed) plans."""
    plans_dir = _plans_dir()
    if not plans_dir.is_dir():
        return {}
    result: dict[str, list[dict]] = {}
    for p in plans_dir.glob("*.md"):
        try:
            content = p.read_text(encoding="utf-8")
            steps = parse_steps(content)
            if steps:
                result[p.stem] = steps
        except Exception:
            pass
    return result


def _rag_status_blocks_llm() -> bool:
    """Return True if RAG status means we should skip the LLM call."""
    try:
        from app.services import memory_rag_service
        status = memory_rag_service.get_status().get("status", "")
        return status != "ready"
    except Exception:
        return True


def _judge_steps(slug: str, open_steps: list[dict], events: list[dict]) -> list[dict]:
    """Call Haiku to judge which steps are completed. Returns list of {id, confidence, evidence_index}."""
    if not ANTHROPIC_API_KEY:
        logger.debug("plan_progress_worker: no ANTHROPIC_API_KEY, skipping LLM")
        return []
    if _rag_status_blocks_llm():
        logger.debug("plan_progress_worker: RAG not ready, skipping LLM")
        return []

    unchecked = [s for s in open_steps if not s.get("checked")]
    if not unchecked:
        return []

    steps_text = "\n".join(f"{s['id']}: {s['text']}" for s in unchecked)
    events_text = json.dumps(events[:50], indent=0)  # cap to avoid massive prompt

    prompt = (
        f"Open steps:\n{steps_text}\n\n"
        f"Recent tool call events:\n{events_text}\n\n"
        "Which steps were completed? Reply with JSON only, no prose:\n"
        '{"completed":[{"id":<int>,"confidence":<0-1>,"evidence_index":<int or null>}]}'
    )

    try:
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model=ANTHROPIC_HAIKU_MODEL,
            max_tokens=512,
            system="Judge whether tool calls completed plan steps. JSON only.",
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            getattr(b, "text", "") for b in resp.content if hasattr(b, "text")
        ).strip()
        data = json.loads(text)
        return data.get("completed", [])
    except Exception as exc:
        logger.warning("plan_progress_worker: Haiku call failed: %s", exc)
        return []


def _process_events(events: list[dict]) -> None:
    """Group events by pinned slug or by open plan, judge and apply."""
    if not events:
        return

    open_plans = _open_plans()
    if not open_plans:
        return

    # Group events per plan slug — use pinned session or broadcast to all plans
    plan_events: dict[str, list[dict]] = {slug: [] for slug in open_plans}
    for ev in events:
        session_id = ev.get("session_id") or ev.get("sessionId")
        pinned_slug = None
        if session_id:
            pinned_slug = plan_progress_service.get_pinned_slug(str(session_id))
        if pinned_slug and pinned_slug in plan_events:
            plan_events[pinned_slug].append(ev)
        else:
            for slug_list in plan_events.values():
                slug_list.append(ev)

    for slug, evts in plan_events.items():
        if not evts:
            continue
        open_steps = open_plans[slug]

        # Read current progress to get checked state
        progress = plan_progress_service.read(slug)
        if progress:
            checked_ids = {s["id"] for s in progress.get("steps", []) if s.get("checked")}
        else:
            checked_ids: set[int] = set()

        effective_open = [s for s in open_steps if s["id"] not in checked_ids]
        if not effective_open:
            continue

        judgments = _judge_steps(slug, effective_open, evts)
        for j in judgments:
            step_id = j.get("id")
            confidence = j.get("confidence", 0.0)
            ev_idx = j.get("evidence_index")
            if step_id is None or confidence < _CONFIDENCE_THRESHOLD:
                continue
            ev_data: dict | None = None
            if ev_idx is not None and 0 <= ev_idx < len(evts):
                src_ev = evts[ev_idx]
                ev_data = {
                    "source": "claude-code",
                    "session_id": src_ev.get("session_id") or src_ev.get("sessionId"),
                    "tool_call_summary": str(src_ev.get("tool", src_ev.get("toolName", "")))[:200],
                }
            plan_progress_service.toggle_step(slug, step_id, True, ev_data)

        # Re-read progress and check if all steps are done → archive
        updated = plan_progress_service.read(slug)
        if updated:
            done_ids = {s["id"] for s in updated.get("steps", []) if s.get("checked")}
            all_ids = {s["id"] for s in open_steps}
            if all_ids and all_ids <= done_ids:
                try:
                    plan_archive_service.archive(slug)
                    logger.info("plan_progress_worker: archived completed plan '%s'", slug)
                except Exception as exc:
                    logger.warning("plan_progress_worker: archive failed for '%s': %s", slug, exc)


def _worker_loop() -> None:
    time.sleep(15)  # let startup settle
    while True:
        try:
            events = plan_event_queue.drain(n=20, timeout=30)
            _process_events(events)
        except Exception as exc:
            logger.exception("plan_progress_worker: error in worker loop: %s", exc)
        time.sleep(_WORKER_INTERVAL)


def start() -> None:
    """Launch the background worker daemon. Idempotent."""
    global _started
    with _start_lock:
        if _started:
            return
        _started = True
    t = threading.Thread(target=_worker_loop, daemon=True, name="plan-progress-worker")
    t.start()
    logger.info("plan_progress_worker: started")
