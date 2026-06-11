"""
Scheduled Automation — in-app cron scheduler running built-in maintenance
actions (issue #24).

Unlike Loops (host crontab driving Claude/shell tasks), this scheduler is a
single daemon thread inside the Flask process: it ticks every 30 s, evaluates
each enabled task's cron expression with ``croniter``, and executes the task's
built-in action (see ``builtin_actions.py``) in-process. It therefore works
identically in the Docker container, with no crontab and no host runner.

Persistence:
  backend/data/scheduled_tasks.json — task definitions (list[dict])
  backend/data/scheduler_runs.json  — run records, newest first (list[dict])

Quiet-window guard: a guarded task due while GWS activity was seen in the last
30 minutes is deferred and re-checked each tick; after 2 h of deferral it runs
anyway. Manual run-now bypasses the guard.
"""
from __future__ import annotations

import logging
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from croniter import croniter

from app.core.atomic_json import read_json, write_json_atomic

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_TASKS_FILE = _DATA_DIR / "scheduled_tasks.json"
_RUNS_FILE = _DATA_DIR / "scheduler_runs.json"

_TICK_SECONDS = 30
_MAX_RUNS = 500
_QUIET_WINDOW = timedelta(minutes=30)
_MAX_DEFER = timedelta(hours=2)

_lock = threading.RLock()
_thread: threading.Thread | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def validate_cron(cron: str) -> str:
    cron = (cron or "").strip()
    if not cron or len(cron) > 120:
        raise ValueError("cron expression is required (max 120 chars)")
    if not croniter.is_valid(cron):
        raise ValueError(f"invalid cron expression: {cron!r}")
    return cron


def next_fire(cron: str, base: datetime | None = None) -> datetime:
    return croniter(cron, base or _now()).get_next(datetime)


# ---------------------------------------------------------------------------
# Task registry (CRUD)
# ---------------------------------------------------------------------------

def load_tasks() -> list[dict]:
    with _lock:
        data = read_json(_TASKS_FILE, default=[])
    return data if isinstance(data, list) else []


def _save_tasks(tasks: list[dict]) -> None:
    with _lock:
        write_json_atomic(_TASKS_FILE, tasks, indent=True)


def get_task(task_id: str) -> dict | None:
    return next((t for t in load_tasks() if t.get("id") == task_id), None)


def create_task(
    name: str,
    action: str,
    cron: str,
    params: dict | None = None,
    enabled: bool = True,
    quiet_guard: bool = True,
    description: str = "",
) -> dict:
    from app.services import builtin_actions

    if action not in builtin_actions.REGISTRY:
        raise ValueError(f"unknown action: {action!r}")
    cron = validate_cron(cron)
    now = _now()
    task = {
        "id": uuid.uuid4().hex[:12],
        "name": (name or "").strip() or action,
        "description": description,
        "action": action,
        "params": params or {},
        "cron": cron,
        "enabled": bool(enabled),
        "quiet_guard": bool(quiet_guard),
        "created_at": _iso(now),
        "updated_at": _iso(now),
        "next_run_at": _iso(next_fire(cron, now)),
        "deferred_since": None,
        "last_run_at": None,
        "last_status": None,
    }
    with _lock:
        tasks = load_tasks()
        tasks.append(task)
        _save_tasks(tasks)
    return task


def update_task(task_id: str, patch: dict) -> dict | None:
    from app.services import builtin_actions

    allowed = {"name", "description", "action", "params", "cron", "enabled", "quiet_guard"}
    patch = {k: v for k, v in patch.items() if k in allowed}
    if "action" in patch and patch["action"] not in builtin_actions.REGISTRY:
        raise ValueError(f"unknown action: {patch['action']!r}")
    if "cron" in patch:
        patch["cron"] = validate_cron(patch["cron"])
    with _lock:
        tasks = load_tasks()
        for i, t in enumerate(tasks):
            if t.get("id") == task_id:
                t.update(patch)
                t["updated_at"] = _iso(_now())
                # Schedule or enablement changed → recompute next fire, clear deferral.
                if "cron" in patch or patch.get("enabled"):
                    t["next_run_at"] = _iso(next_fire(t["cron"]))
                    t["deferred_since"] = None
                tasks[i] = t
                _save_tasks(tasks)
                return t
    return None


def delete_task(task_id: str) -> bool:
    with _lock:
        tasks = load_tasks()
        kept = [t for t in tasks if t.get("id") != task_id]
        if len(kept) == len(tasks):
            return False
        _save_tasks(kept)
    return True


# ---------------------------------------------------------------------------
# Run log
# ---------------------------------------------------------------------------

def load_runs(task_id: str | None = None, limit: int = 50) -> list[dict]:
    with _lock:
        runs = read_json(_RUNS_FILE, default=[])
    if not isinstance(runs, list):
        runs = []
    if task_id:
        runs = [r for r in runs if r.get("task_id") == task_id]
    return runs[:limit]


def _append_run(run: dict) -> None:
    with _lock:
        runs = read_json(_RUNS_FILE, default=[])
        if not isinstance(runs, list):
            runs = []
        runs.insert(0, run)
        write_json_atomic(_RUNS_FILE, runs[:_MAX_RUNS], indent=True)


def _record_task_outcome(task_id: str, status: str, *, reschedule: bool) -> None:
    with _lock:
        tasks = load_tasks()
        for i, t in enumerate(tasks):
            if t.get("id") == task_id:
                t["last_run_at"] = _iso(_now())
                t["last_status"] = status
                t["deferred_since"] = None
                if reschedule:
                    t["next_run_at"] = _iso(next_fire(t["cron"]))
                tasks[i] = t
                _save_tasks(tasks)
                return


# ---------------------------------------------------------------------------
# Quiet-window guard (#39)
# ---------------------------------------------------------------------------

def is_quiet(window: timedelta = _QUIET_WINDOW) -> bool:
    """True when no GWS activity record started inside the quiet window."""
    try:
        from app.services import gws_activity_scanner

        cutoff = _now() - window
        for record in gws_activity_scanner.load().get("records", []):
            raw = record.get("started_at") or ""
            try:
                started = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                continue
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            if started >= cutoff:
                return False
    except Exception:
        logger.exception("quiet-window check failed; treating as quiet")
    return True


def _mark_deferred(task_id: str) -> None:
    with _lock:
        tasks = load_tasks()
        for i, t in enumerate(tasks):
            if t.get("id") == task_id and not t.get("deferred_since"):
                t["deferred_since"] = _iso(_now())
                tasks[i] = t
                _save_tasks(tasks)
                return


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

def execute_task(task: dict, trigger: str = "cron") -> dict:
    """Run a task's built-in action synchronously and persist the run record."""
    from app.services import builtin_actions

    started = _now()
    run = {
        "id": uuid.uuid4().hex[:12],
        "task_id": task["id"],
        "task_name": task.get("name", ""),
        "action": task.get("action", ""),
        "trigger": trigger,
        "started_at": _iso(started),
        "finished_at": None,
        "duration_ms": None,
        "status": "running",
        "result": None,
        "error": None,
    }
    try:
        result = builtin_actions.execute(task["action"], task.get("params") or {})
        run["status"] = "success"
        run["result"] = result
    except Exception as exc:
        logger.exception("scheduled task %s (%s) failed", task.get("name"), task.get("id"))
        run["status"] = "error"
        run["error"] = str(exc)
    finished = _now()
    run["finished_at"] = _iso(finished)
    run["duration_ms"] = int((finished - started).total_seconds() * 1000)
    _append_run(run)
    _record_task_outcome(task["id"], run["status"], reschedule=(trigger == "cron"))
    return run


def run_now(task_id: str) -> dict | None:
    """Manual trigger: run asynchronously, bypassing the quiet-window guard."""
    task = get_task(task_id)
    if task is None:
        return None
    threading.Thread(
        target=execute_task, args=(task, "manual"),
        daemon=True, name=f"scheduler-run-{task_id}",
    ).start()
    return task


# ---------------------------------------------------------------------------
# Daemon loop (#36)
# ---------------------------------------------------------------------------

def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _tick() -> None:
    now = _now()
    for task in load_tasks():
        if not task.get("enabled"):
            continue
        due_at = _parse_iso(task.get("next_run_at"))
        if due_at is None:
            # Backfill next_run_at for tasks created before this field existed.
            update_task(task["id"], {"enabled": True})
            continue
        if due_at > now:
            continue
        if task.get("quiet_guard") and not is_quiet():
            deferred_since = _parse_iso(task.get("deferred_since"))
            if deferred_since is None:
                _mark_deferred(task["id"])
                continue
            if now - deferred_since < _MAX_DEFER:
                continue  # keep deferring until the cap, then fall through
        execute_task(task, trigger="cron")


def _loop() -> None:
    time.sleep(15)  # let the app finish booting
    while True:
        try:
            _tick()
        except Exception:
            logger.exception("scheduler tick failed")
        try:
            from app.core import scanner_registry

            scanner_registry.heartbeat("scheduler", interval=float(_TICK_SECONDS))
        except Exception:
            pass
        time.sleep(_TICK_SECONDS)


def start_background_scheduler() -> None:
    global _thread
    if _thread is not None and _thread.is_alive():
        return
    _thread = threading.Thread(target=_loop, daemon=True, name="scheduler-daemon")
    _thread.start()


def get_status() -> dict:
    tasks = load_tasks()
    return {
        "running": _thread is not None and _thread.is_alive(),
        "tick_seconds": _TICK_SECONDS,
        "quiet": is_quiet(),
        "quiet_window_minutes": int(_QUIET_WINDOW.total_seconds() // 60),
        "max_defer_minutes": int(_MAX_DEFER.total_seconds() // 60),
        "task_count": len(tasks),
        "enabled_count": sum(1 for t in tasks if t.get("enabled")),
    }
