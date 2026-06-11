from flask import Blueprint, jsonify, request
from app.services import eval_service, eval_judge_service

bp = Blueprint("evals", __name__, url_prefix="/api/evals")


@bp.get("/sessions")
def list_sessions():
    days_param = request.args.get("days", "30")
    try:
        days = None if days_param == "all" else int(days_param)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid days parameter"}), 400

    tool_filter = request.args.get("tool")  # "claude" | "codex" | None
    grade_filter = request.args.get("grade")  # "A" | "B" | ... | None
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(1, int(request.args.get("limit", 50))))

    stats = eval_service.build_stats(days=days)
    results = list(eval_service.load_results().values())

    # Filter by time window (reuse stats build logic)
    from datetime import datetime, timezone, timedelta
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        filtered = []
        for r in results:
            ts = r.get("last_ts") or r.get("first_ts") or r.get("graded_at", "")
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if dt >= cutoff:
                    filtered.append(r)
            except Exception:
                continue
        results = filtered

    if tool_filter:
        results = [r for r in results if r.get("tool") == tool_filter]
    if grade_filter:
        results = [r for r in results if r.get("grade") == grade_filter]

    results.sort(key=lambda r: r.get("last_ts") or r.get("graded_at") or "", reverse=True)

    total = len(results)
    page_results = results[(page - 1) * limit: page * limit]

    return jsonify({
        "sessions": page_results,
        "total": total,
        "page": page,
        "limit": limit,
        "stats": stats,
    })


@bp.get("/sessions/<session_id>")
def get_session(session_id: str):
    result = eval_service.get_result(session_id)
    if result is None:
        return jsonify({"error": "Session not found or not yet graded"}), 404
    return jsonify(result)


@bp.post("/sessions/<session_id>/grade")
def grade_session(session_id: str):
    """Trigger a manual re-grade for a single session."""
    # Mark pending first so UI can show progress
    results = eval_service.load_results()
    if session_id in results:
        results[session_id]["status"] = "pending"
        eval_service._save_results(results)

    import threading
    def _do_grade():
        try:
            eval_service.grade_one(session_id)
        except Exception:
            pass

    t = threading.Thread(target=_do_grade, daemon=True)
    t.start()

    return jsonify({"status": "queued", "session_id": session_id})


@bp.get("/stats")
def get_stats():
    days_param = request.args.get("days", "30")
    try:
        days = None if days_param == "all" else int(days_param)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid days parameter"}), 400
    return jsonify(eval_service.build_stats(days=days))


@bp.post("/scan")
def trigger_scan():
    """Grade all ungraded sessions (up to 100)."""
    limit = min(200, max(1, int(request.args.get("limit", 100))))
    graded = eval_service.scan_ungraded(limit=limit)
    return jsonify({"graded": graded, "stats": eval_service.build_stats()})


@bp.patch("/sessions/<session_id>/repo")
def update_repo(session_id: str):
    """Let the user override the auto-detected repo path for a session."""
    body = request.get_json(silent=True) or {}
    repo_path = body.get("repo_path", "").strip()
    if not repo_path:
        return jsonify({"error": "repo_path is required"}), 400
    ok = eval_service.update_repo_override(session_id, repo_path)
    if not ok:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"status": "ok", "session_id": session_id, "repo_path": repo_path})


@bp.get("/budget")
def get_budget():
    return jsonify(eval_judge_service.get_budget_status())
