"""
Loop runner — executed by cron (or a manual trigger) to fire one loop.

Usage (from the backend directory, with the venv active or via its python):

    python -m scripts.loop_runner <loop_id> [--trigger cron|manual]

It records a 'running' run, executes the loop's command, and finishes the run
with the exit code + captured Claude session_id (for kind=claude). The session
id lets the eval system grade the run later, powering the per-loop grade trend.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Make `app` importable when invoked as `python -m scripts.loop_runner`
# from the backend directory.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.services import loops_service  # noqa: E402
from app.services.video_research_runner import resolve_claude_bin  # noqa: E402

_RUN_TIMEOUT_S = 3600  # 1 hour hard cap per run

# The runner executes `claude` on the host but reports run records to the live
# CCC API, so the dashboard (which may run in Docker with its own data volume)
# is the single source of truth. Falls back to direct file writes if the API
# is unreachable (host-only / dev setups).
_API_BASE = os.environ.get("CCC_API_BASE", "http://127.0.0.1:5050").rstrip("/")


def _api(method: str, path: str, body: dict | None = None) -> dict | None:
    url = f"{_API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-Requested-With", "XMLHttpRequest")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}


def _run_claude(prompt: str, cwd: str) -> tuple[int, str | None, str]:
    """Run `claude -p <prompt> --output-format json`. Returns (exit_code, session_id, log)."""
    claude_bin = resolve_claude_bin()
    if claude_bin is None:
        return 127, None, "claude CLI not found — install Claude Code first"

    cmd = [
        claude_bin,
        "-p",
        prompt,
        "--output-format",
        "json",
        "--dangerously-skip-permissions",
    ]
    workdir = cwd if cwd and os.path.isdir(cwd) else None
    try:
        proc = subprocess.run(
            cmd,
            cwd=workdir,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=_RUN_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return 124, None, f"timed out after {_RUN_TIMEOUT_S}s"

    out = proc.stdout or ""
    session_id = None
    try:
        payload = json.loads(out)
        session_id = payload.get("session_id")
    except Exception:
        pass

    log = out
    if proc.stderr:
        log += "\n[stderr]\n" + proc.stderr
    return proc.returncode, session_id, log


def _run_shell(command: str, cwd: str) -> tuple[int, str | None, str]:
    workdir = cwd if cwd and os.path.isdir(cwd) else None
    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=workdir,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=_RUN_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return 124, None, f"timed out after {_RUN_TIMEOUT_S}s"
    log = (proc.stdout or "")
    if proc.stderr:
        log += "\n[stderr]\n" + proc.stderr
    return proc.returncode, None, log


def _get_loop(loop_id: str) -> dict | None:
    """Fetch loop definition from the live API, falling back to local file."""
    try:
        return _api("GET", f"/api/loops/{loop_id}")
    except (urllib.error.URLError, OSError, ValueError):
        return loops_service.get_loop(loop_id)


def _start_run(loop_id: str, trigger: str) -> tuple[str, bool]:
    """Open a 'running' record. Returns (run_id, used_api)."""
    try:
        run = _api("POST", f"/api/loops/{loop_id}/runs", {"trigger": trigger})
        return run["run_id"], True
    except (urllib.error.URLError, OSError, ValueError, KeyError):
        run = loops_service.start_run(loop_id, trigger=trigger)
        return run["run_id"], False


def _finish_run(loop_id: str, run_id: str, used_api: bool, *, exit_code: int, session_id, log: str) -> None:
    if used_api:
        try:
            _api("PATCH", f"/api/loops/{loop_id}/runs/{run_id}", {
                "exit_code": exit_code, "session_id": session_id, "log_tail": log,
            })
            return
        except (urllib.error.URLError, OSError, ValueError):
            pass
    loops_service.finish_run(run_id, exit_code=exit_code, session_id=session_id, log_tail=log)


def main() -> int:
    parser = argparse.ArgumentParser(description="Fire one CCC loop.")
    parser.add_argument("loop_id")
    parser.add_argument("--trigger", default="cron", choices=["cron", "manual"])
    args = parser.parse_args()

    loop = _get_loop(args.loop_id)
    if loop is None:
        print(f"loop not found: {args.loop_id}", file=sys.stderr)
        return 2
    if not loop.get("enabled", True):
        print(f"loop disabled, skipping: {args.loop_id}", file=sys.stderr)
        return 0

    run_id, used_api = _start_run(args.loop_id, args.trigger)

    if loop.get("kind") == "shell":
        exit_code, session_id, log = _run_shell(loop.get("command", ""), loop.get("cwd", ""))
    else:
        exit_code, session_id, log = _run_claude(loop.get("prompt", ""), loop.get("cwd", ""))

    _finish_run(args.loop_id, run_id, used_api, exit_code=exit_code, session_id=session_id, log=log)
    print(f"loop {args.loop_id} run {run_id} finished rc={exit_code} session={session_id} (api={used_api})")
    return 0 if exit_code == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
