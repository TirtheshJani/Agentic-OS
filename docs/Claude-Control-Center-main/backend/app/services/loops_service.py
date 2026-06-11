"""
Loops service — definitions, run records, and per-loop analytics.

A *loop* is a recurring Claude Code (or shell) task driven by a local cron
entry. Each fire produces a *run* record; when a run is a ``claude`` loop the
runner captures the resulting ``session_id`` so the run can be joined to the
existing eval system (``eval_results.json``) for a quality-over-time trend.

Persistence:
  backend/data/loops.json        — loop definitions (list[dict])
  backend/data/loop_runs.json    — run records (list[dict], newest first)

Writes use the ``.tmp`` → ``os.replace`` atomic pattern. The loop runner
(``scripts/loop_runner.py``) imports this module so all read/write logic lives
in one place.
"""
from __future__ import annotations

import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import orjson

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_LOOPS_FILE = _DATA_DIR / "loops.json"
_RUNS_FILE = _DATA_DIR / "loop_runs.json"
_EVAL_FILE = _DATA_DIR / "eval_results.json"

_LOG_TAIL_BYTES = 4096
_VALID_KINDS = {"claude", "shell"}

_lock = threading.RLock()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:60] or "loop"


# Strict cron grammar: 5 or 6 whitespace-separated fields, each using only
# digits and the cron operators */,- . This rejects newlines, carriage
# returns, '#', and any shell metacharacter, preventing crontab-line injection
# when the value is rendered into a managed crontab entry.
_CRON_FIELD = r"[0-9*/,\-]+"
_CRON_RE = re.compile(rf"^{_CRON_FIELD}(?:\s+{_CRON_FIELD}){{4,5}}$")


def validate_cron(cron: str) -> str:
    """Return a sanitized cron expression or raise ValueError if malformed."""
    cron = (cron or "").strip()
    if not cron:
        return ""
    if "\n" in cron or "\r" in cron or len(cron) > 120:
        raise ValueError("invalid cron expression")
    if not _CRON_RE.match(cron):
        raise ValueError("invalid cron expression (expected 5–6 fields of [0-9*/,-])")
    return cron


def _load(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        return orjson.loads(path.read_bytes())
    except Exception:
        return []


def _save(path: Path, data: list[dict]) -> None:
    with _lock:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
        tmp.replace(path)


# ---------------------------------------------------------------------------
# Loop definitions (CRUD)
# ---------------------------------------------------------------------------

def load_loops() -> list[dict]:
    return _load(_LOOPS_FILE)


def get_loop(loop_id: str) -> dict | None:
    return next((l for l in load_loops() if l.get("id") == loop_id), None)


def create_loop(
    *,
    name: str,
    kind: str = "claude",
    prompt: str = "",
    command: str = "",
    cwd: str = "",
    schedule_cron: str = "",
    schedule_human: str = "",
    description: str = "",
    tags: list[str] | None = None,
    enabled: bool = True,
) -> dict:
    name = (name or "").strip()
    if not name:
        raise ValueError("name is required")
    if kind not in _VALID_KINDS:
        raise ValueError(f"invalid kind: {kind}")
    if kind == "claude" and not prompt.strip():
        raise ValueError("prompt is required for a claude loop")
    if kind == "shell" and not command.strip():
        raise ValueError("command is required for a shell loop")
    schedule_cron = validate_cron(schedule_cron)

    loop = {
        "id": str(uuid.uuid4()),
        "name": name,
        "slug": slugify(name),
        "description": description.strip(),
        "kind": kind,
        "prompt": prompt,
        "command": command,
        "cwd": cwd,
        "schedule_cron": schedule_cron.strip(),
        "schedule_human": schedule_human.strip(),
        "tags": tags or [],
        "enabled": bool(enabled),
        "cron_installed": False,
        "created_at": _now(),
        "updated_at": _now(),
    }
    loops = load_loops()
    loops.append(loop)
    _save(_LOOPS_FILE, loops)
    return loop


_MUTABLE_FIELDS = {
    "name", "description", "kind", "prompt", "command", "cwd",
    "schedule_cron", "schedule_human", "tags", "enabled", "cron_installed",
}


def update_loop(loop_id: str, patch: dict) -> dict | None:
    loops = load_loops()
    target = next((l for l in loops if l.get("id") == loop_id), None)
    if target is None:
        return None
    if "schedule_cron" in patch:
        patch = {**patch, "schedule_cron": validate_cron(patch.get("schedule_cron") or "")}
    for k, v in patch.items():
        if k in _MUTABLE_FIELDS:
            target[k] = v
    if "name" in patch and patch["name"]:
        target["slug"] = slugify(patch["name"])
    target["updated_at"] = _now()
    _save(_LOOPS_FILE, loops)
    return target


def delete_loop(loop_id: str) -> bool:
    loops = load_loops()
    remaining = [l for l in loops if l.get("id") != loop_id]
    if len(remaining) == len(loops):
        return False
    _save(_LOOPS_FILE, remaining)
    # Drop this loop's runs too.
    runs = [r for r in load_runs() if r.get("loop_id") != loop_id]
    _save(_RUNS_FILE, runs)
    return True


# ---------------------------------------------------------------------------
# Run records
# ---------------------------------------------------------------------------

def load_runs() -> list[dict]:
    return _load(_RUNS_FILE)


def loop_runs(loop_id: str) -> list[dict]:
    runs = [r for r in load_runs() if r.get("loop_id") == loop_id]
    runs.sort(key=lambda r: r.get("started_at") or "", reverse=True)
    return runs


def start_run(loop_id: str, trigger: str = "cron") -> dict:
    """Append a 'running' run record and return it."""
    run = {
        "run_id": str(uuid.uuid4()),
        "loop_id": loop_id,
        "trigger": trigger,
        "started_at": _now(),
        "ended_at": None,
        "duration_s": None,
        "session_id": None,
        "exit_code": None,
        "status": "running",
        "log_tail": "",
    }
    runs = load_runs()
    runs.insert(0, run)
    _save(_RUNS_FILE, runs)
    return run


def finish_run(
    run_id: str,
    *,
    exit_code: int,
    session_id: str | None = None,
    log_tail: str = "",
) -> dict | None:
    runs = load_runs()
    target = next((r for r in runs if r.get("run_id") == run_id), None)
    if target is None:
        return None
    ended = _now()
    target["ended_at"] = ended
    target["exit_code"] = exit_code
    target["session_id"] = session_id
    target["status"] = "success" if exit_code == 0 else "error"
    target["log_tail"] = (log_tail or "")[-_LOG_TAIL_BYTES:]
    try:
        t0 = datetime.fromisoformat(target["started_at"])
        t1 = datetime.fromisoformat(ended)
        target["duration_s"] = round((t1 - t0).total_seconds(), 1)
    except Exception:
        target["duration_s"] = None
    _save(_RUNS_FILE, runs)
    return target


# ---------------------------------------------------------------------------
# Analytics — joins runs to eval_results for the grade trend
# ---------------------------------------------------------------------------

def _load_eval_index() -> dict[str, dict]:
    if not _EVAL_FILE.exists():
        return {}
    try:
        return orjson.loads(_EVAL_FILE.read_bytes())
    except Exception:
        return {}


def build_loop_stats(loop_id: str) -> dict:
    runs = loop_runs(loop_id)
    completed = [r for r in runs if r.get("status") in ("success", "error")]
    total = len(completed)

    success = sum(1 for r in completed if r.get("status") == "success")
    success_rate = round(success / total * 100, 1) if total else None

    durations = [r["duration_s"] for r in completed if r.get("duration_s") is not None]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else None

    last_run = runs[0] if runs else None

    # Grade trend: join run.session_id → eval_results.
    evals = _load_eval_index()
    grade_trend: list[dict] = []
    for r in sorted(completed, key=lambda x: x.get("started_at") or ""):
        sid = r.get("session_id")
        ev = evals.get(sid) if sid else None
        if ev and ev.get("status") == "done":
            grade_trend.append({
                "run_id": r["run_id"],
                "at": r.get("ended_at") or r.get("started_at"),
                "session_id": sid,
                "composite_score": ev.get("composite_score"),
                "grade": ev.get("grade"),
            })

    improvement = None
    if len(grade_trend) >= 2:
        first = grade_trend[0]["composite_score"]
        latest = grade_trend[-1]["composite_score"]
        if first is not None and latest is not None:
            improvement = round(latest - first, 1)

    avg_score = None
    scored = [g["composite_score"] for g in grade_trend if g.get("composite_score") is not None]
    if scored:
        avg_score = round(sum(scored) / len(scored), 1)

    # Runs per ISO week.
    week_counts: dict[str, int] = {}
    for r in completed:
        ts = r.get("started_at")
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(ts)
            wk = dt.strftime("%Y-W%V")
            week_counts[wk] = week_counts.get(wk, 0) + 1
        except Exception:
            continue
    by_week = sorted(
        [{"week": k, "count": v} for k, v in week_counts.items()],
        key=lambda x: x["week"],
    )

    return {
        "loop_id": loop_id,
        "total_runs": total,
        "success_rate": success_rate,
        "avg_duration_s": avg_duration,
        "last_run_at": last_run.get("started_at") if last_run else None,
        "last_status": last_run.get("status") if last_run else None,
        "graded_runs": len(grade_trend),
        "avg_score": avg_score,
        "improvement": improvement,
        "grade_trend": grade_trend,
        "by_week": by_week,
    }
