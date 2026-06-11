"""
Loop cron integration — render a loop definition to a crontab line and
install / remove it in the *user* crontab.

This is the one place the app writes outside ``~/.claude``. Install and remove
are explicit, user-triggered operations (POST/DELETE ``/loops/<id>/cron``); the
app never edits the crontab on its own. Each managed line carries a marker
comment so we can find and replace it idempotently:

    # ccc-loop:<loop_id>
    0 0 * * 1 cd <backend> && <venv-python> -m scripts.loop_runner <loop_id> --trigger cron >> data/loop_cron.log 2>&1
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from datetime import datetime, timezone

from app.core.atomic_json import read_json, write_json_atomic
from app.services.loops_service import validate_cron

_BACKEND_DIR = Path(__file__).parent.parent.parent  # .../backend
_MARKER = "# ccc-loop:"

# Snapshot of the host crontab, reported by scripts/cron_reporter.py so the
# dockerized dashboard (which cannot read the host crontab) can still display
# discovered cron jobs.
_SNAPSHOT_FILE = _BACKEND_DIR / "data" / "discovered_cron.json"
_MAX_SNAPSHOT_ENTRIES = 200


def _python_bin() -> str:
    """Prefer the venv interpreter running this process; fall back to python3."""
    return sys.executable or "python3"


def render_cron_line(loop: dict) -> str:
    """Build the crontab line (marker comment + schedule) for a loop."""
    loop_id = loop["id"]
    # Re-validate as defense-in-depth before the value reaches the crontab.
    cron = validate_cron(loop.get("schedule_cron") or "")
    py = _python_bin()
    cmd = (
        f"cd '{_BACKEND_DIR}' && '{py}' -m scripts.loop_runner {loop_id} "
        f"--trigger cron >> data/loop_cron.log 2>&1"
    )
    return f"{_MARKER}{loop_id}\n{cron} {cmd}"


def _read_crontab() -> list[str]:
    try:
        r = subprocess.run(["crontab", "-l"], capture_output=True, text=True, timeout=10)
    except FileNotFoundError:
        raise RuntimeError("crontab command not found on this system")
    if r.returncode != 0:
        # "no crontab for user" → empty.
        return []
    return r.stdout.splitlines()


def _strip_loop(lines: list[str], loop_id: str) -> list[str]:
    """Remove an existing managed block (marker line + the following schedule line)."""
    out: list[str] = []
    skip_next = False
    marker = f"{_MARKER}{loop_id}"
    for line in lines:
        if skip_next:
            skip_next = False
            continue
        if line.strip() == marker:
            skip_next = True  # drop the schedule line that follows
            continue
        out.append(line)
    return out


def _write_crontab(lines: list[str]) -> None:
    body = "\n".join(l for l in lines if l is not None).rstrip("\n") + "\n"
    r = subprocess.run(["crontab", "-"], input=body, text=True, capture_output=True, timeout=10)
    if r.returncode != 0:
        raise RuntimeError(f"failed to write crontab: {r.stderr.strip()}")


def install(loop: dict) -> str:
    """Install (or replace) the managed crontab line for a loop. Returns the line."""
    if not (loop.get("schedule_cron") or "").strip():
        raise RuntimeError("loop has no schedule_cron")
    lines = _strip_loop(_read_crontab(), loop["id"])
    block = render_cron_line(loop)
    lines.extend(block.split("\n"))
    _write_crontab(lines)
    return block


def remove(loop_id: str) -> bool:
    """Remove the managed crontab line for a loop. Returns True if something was removed."""
    before = _read_crontab()
    after = _strip_loop(before, loop_id)
    if len(after) == len(before):
        return False
    _write_crontab(after)
    return True


def is_installed(loop_id: str) -> bool:
    marker = f"{_MARKER}{loop_id}"
    return any(line.strip() == marker for line in _read_crontab())


# A schedule (5 fields or @daily-style nickname) followed by a command.
# Env-assignment lines (PATH=...) don't have enough fields and won't match.
_CRON_LINE_RE = re.compile(r"^(@\w+|(?:\S+\s+){4}\S+)\s+(.+)$")


def discover() -> dict:
    """Parse the user crontab into entries so existing loops show on the dashboard.

    Returns ``{"available": bool, "entries": [...], "error": str|None}``. Each
    entry carries ``managed``/``loop_id`` when it is a CCC-managed loop line, so
    the UI can distinguish loops created here from external cron jobs. Inside
    the Docker container the host crontab is unreachable → ``available: False``.
    """
    try:
        lines = _read_crontab()
    except (RuntimeError, subprocess.TimeoutExpired) as exc:
        snapshot = load_snapshot()
        if snapshot is not None:
            return {
                "available": True,
                "error": None,
                "source": "host-report",
                "reported_at": snapshot.get("reported_at"),
                "entries": snapshot.get("entries", []),
            }
        return {"available": False, "error": str(exc), "source": None, "reported_at": None, "entries": []}

    entries: list[dict] = []
    pending_loop_id: str | None = None
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith(_MARKER):
            pending_loop_id = line[len(_MARKER):].strip()
            continue
        if line.startswith("#"):
            pending_loop_id = None
            continue
        m = _CRON_LINE_RE.match(line)
        if m:
            entries.append({
                "schedule": m.group(1),
                "command": m.group(2),
                "managed": pending_loop_id is not None,
                "loop_id": pending_loop_id,
            })
        pending_loop_id = None
    return {"available": True, "error": None, "source": "live", "reported_at": None, "entries": entries}


def sanitize_entries(raw: object) -> list[dict]:
    """Validate a reported entry list down to known string fields, capped."""
    if not isinstance(raw, list):
        raise ValueError("entries must be a list")
    entries: list[dict] = []
    for item in raw[:_MAX_SNAPSHOT_ENTRIES]:
        if not isinstance(item, dict):
            continue
        schedule = str(item.get("schedule", ""))[:120]
        command = str(item.get("command", ""))[:1000]
        if not schedule or not command:
            continue
        loop_id = item.get("loop_id")
        entries.append({
            "schedule": schedule,
            "command": command,
            "managed": bool(item.get("managed")),
            "loop_id": str(loop_id)[:64] if isinstance(loop_id, str) else None,
        })
    return entries


def save_snapshot(entries: list[dict]) -> dict:
    """Persist a host-reported crontab snapshot (used as the Docker fallback)."""
    snapshot = {
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }
    write_json_atomic(_SNAPSHOT_FILE, snapshot, indent=True)
    return snapshot


def load_snapshot() -> dict | None:
    data = read_json(_SNAPSHOT_FILE, default=None)
    return data if isinstance(data, dict) else None
