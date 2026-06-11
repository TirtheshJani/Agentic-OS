"""Loops routes — definitions, runs, analytics, manual trigger, cron install."""
from __future__ import annotations

import subprocess
import sys
import threading
from pathlib import Path

from flask import Blueprint, jsonify, request

from app.services import loops_service, loop_cron_service

bp = Blueprint("loops", __name__, url_prefix="/api/loops")

_BACKEND_DIR = Path(__file__).parent.parent.parent


def _with_cron_state(loop: dict) -> dict:
    """Attach live crontab-installed state to a loop dict."""
    try:
        installed = loop_cron_service.is_installed(loop["id"])
    except Exception:
        installed = loop.get("cron_installed", False)
    return {**loop, "cron_installed": installed}


def _safe_cron_line(loop: dict) -> str | None:
    """Render the cron line, returning None if the loop has no/invalid schedule."""
    if not loop.get("schedule_cron"):
        return None
    try:
        return loop_cron_service.render_cron_line(loop)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Definitions
# ---------------------------------------------------------------------------

@bp.get("")
def list_loops():
    loops = [_with_cron_state(l) for l in loops_service.load_loops()]
    loops.sort(key=lambda l: l.get("created_at") or "", reverse=True)
    # Light stats per loop for the list view.
    items = []
    for l in loops:
        stats = loops_service.build_loop_stats(l["id"])
        items.append({**l, "stats": stats})
    return jsonify({"loops": items})


@bp.post("")
def create_loop():
    body = request.get_json(silent=True) or {}
    try:
        loop = loops_service.create_loop(
            name=body.get("name", ""),
            kind=body.get("kind", "claude"),
            prompt=body.get("prompt", ""),
            command=body.get("command", ""),
            cwd=body.get("cwd", ""),
            schedule_cron=body.get("schedule_cron", ""),
            schedule_human=body.get("schedule_human", ""),
            description=body.get("description", ""),
            tags=body.get("tags") or [],
            enabled=body.get("enabled", True),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(loop), 201


@bp.get("/<loop_id>")
def get_loop(loop_id: str):
    loop = loops_service.get_loop(loop_id)
    if loop is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        **_with_cron_state(loop),
        "cron_line": _safe_cron_line(loop),
        "stats": loops_service.build_loop_stats(loop_id),
    })


@bp.patch("/<loop_id>")
def patch_loop(loop_id: str):
    body = request.get_json(silent=True) or {}
    try:
        updated = loops_service.update_loop(loop_id, body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if updated is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(_with_cron_state(updated))


@bp.delete("/<loop_id>")
def delete_loop(loop_id: str):
    # Best-effort: remove any installed cron line first.
    try:
        loop_cron_service.remove(loop_id)
    except Exception:
        pass
    if not loops_service.delete_loop(loop_id):
        return jsonify({"error": "not found"}), 404
    return jsonify({"deleted": True})


# ---------------------------------------------------------------------------
# Runs + analytics
# ---------------------------------------------------------------------------

@bp.get("/<loop_id>/runs")
def list_runs(loop_id: str):
    if loops_service.get_loop(loop_id) is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"runs": loops_service.loop_runs(loop_id)})


@bp.get("/<loop_id>/stats")
def loop_stats(loop_id: str):
    if loops_service.get_loop(loop_id) is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(loops_service.build_loop_stats(loop_id))


@bp.post("/<loop_id>/runs")
def open_run(loop_id: str):
    """Register a 'running' run record (called by the host runner over HTTP)."""
    if loops_service.get_loop(loop_id) is None:
        return jsonify({"error": "not found"}), 404
    body = request.get_json(silent=True) or {}
    trigger = body.get("trigger", "cron")
    run = loops_service.start_run(loop_id, trigger=trigger)
    return jsonify(run), 201


@bp.patch("/<loop_id>/runs/<run_id>")
def close_run(loop_id: str, run_id: str):
    """Finish a run record with exit code + captured session id."""
    if loops_service.get_loop(loop_id) is None:
        return jsonify({"error": "not found"}), 404
    body = request.get_json(silent=True) or {}
    try:
        exit_code = int(body.get("exit_code"))
    except (TypeError, ValueError):
        return jsonify({"error": "exit_code (int) required"}), 400
    run = loops_service.finish_run(
        run_id,
        exit_code=exit_code,
        session_id=body.get("session_id"),
        log_tail=body.get("log_tail", ""),
    )
    if run is None:
        return jsonify({"error": "run not found"}), 404
    return jsonify(run)


@bp.post("/<loop_id>/run")
def run_loop(loop_id: str):
    """Fire the loop now (manual trigger) in a background thread."""
    loop = loops_service.get_loop(loop_id)
    if loop is None:
        return jsonify({"error": "not found"}), 404

    def _do_run():
        try:
            subprocess.run(
                [sys.executable, "-m", "scripts.loop_runner", loop_id, "--trigger", "manual"],
                cwd=str(_BACKEND_DIR),
                stdin=subprocess.DEVNULL,
                timeout=3700,
            )
        except Exception:
            pass

    threading.Thread(target=_do_run, daemon=True).start()
    return jsonify({"triggered": True, "loop_id": loop_id}), 202


# ---------------------------------------------------------------------------
# Cron install / remove (explicit, user-triggered)
# ---------------------------------------------------------------------------

@bp.get("/<loop_id>/cron")
def cron_preview(loop_id: str):
    loop = loops_service.get_loop(loop_id)
    if loop is None:
        return jsonify({"error": "not found"}), 404
    if not loop.get("schedule_cron"):
        return jsonify({"error": "loop has no schedule_cron"}), 400
    try:
        installed = loop_cron_service.is_installed(loop_id)
    except Exception:
        installed = False
    try:
        cron_line = loop_cron_service.render_cron_line(loop)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"cron_line": cron_line, "installed": installed})


@bp.post("/<loop_id>/cron")
def cron_install(loop_id: str):
    loop = loops_service.get_loop(loop_id)
    if loop is None:
        return jsonify({"error": "not found"}), 404
    try:
        line = loop_cron_service.install(loop)
    except (RuntimeError, ValueError) as exc:
        return jsonify({"error": str(exc)}), 400
    loops_service.update_loop(loop_id, {"cron_installed": True})
    return jsonify({"installed": True, "cron_line": line})


@bp.delete("/<loop_id>/cron")
def cron_remove(loop_id: str):
    if loops_service.get_loop(loop_id) is None:
        return jsonify({"error": "not found"}), 404
    try:
        removed = loop_cron_service.remove(loop_id)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 400
    loops_service.update_loop(loop_id, {"cron_installed": False})
    return jsonify({"removed": removed})


@bp.get("/discovered")
def discovered_cron():
    """All user-crontab entries, so pre-existing loops show on the dashboard."""
    return jsonify(loop_cron_service.discover())


@bp.post("/discovered/report")
def report_discovered_cron():
    """Host-side reporter (scripts/cron_reporter.py) pushes the crontab here,
    so the dockerized dashboard can display it despite having no crontab."""
    body = request.get_json(silent=True) or {}
    try:
        entries = loop_cron_service.sanitize_entries(body.get("entries"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    snapshot = loop_cron_service.save_snapshot(entries)
    return jsonify({"stored": True, "count": len(entries), "reported_at": snapshot["reported_at"]})
