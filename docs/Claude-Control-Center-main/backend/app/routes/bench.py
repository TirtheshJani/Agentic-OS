"""HTTP surface for the Model A/B Bench — thin over bench_service.

Mutating routes get CSRF protection via the frontend client's
``X-Requested-With`` header (enforced by the app-wide before_request check).
"""
from flask import Blueprint, jsonify, request

from app.services import bench_budget, bench_service
from app.services.bench_providers import available_providers

bp = Blueprint("bench", __name__, url_prefix="/api/bench")


@bp.post("/run")
def run():
    """Fan a prompt across the selected models. Body: {prompt, models, blind}."""
    body = request.get_json(silent=True) or {}
    prompt = (body.get("prompt") or "").strip()
    models = body.get("models") or []
    blind = bool(body.get("blind", False))

    if not prompt:
        return jsonify({"error": "prompt is required"}), 400
    if not isinstance(models, list) or not [m for m in models if m]:
        return jsonify({"error": "at least one model is required"}), 400

    try:
        run_record = bench_service.create_run(prompt, models, blind=blind)
    except bench_budget.BudgetExhaustedError as exc:
        return jsonify({"error": str(exc), "budget": bench_budget.get_budget_status()}), 429
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(bench_service.public_run(run_record))


@bp.get("/runs")
def list_runs():
    """Paginated run history (public view — blind runs stay redacted)."""
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(1, int(request.args.get("limit", 50))))

    runs = bench_service.load_runs()
    total = len(runs)
    page_runs = runs[(page - 1) * limit: page * limit]

    return jsonify({
        "runs": [bench_service.public_run(r) for r in page_runs],
        "total": total,
        "page": page,
        "limit": limit,
    })


@bp.get("/runs/<run_id>")
def get_run(run_id: str):
    run_record = bench_service.get_run(run_id)
    if run_record is None:
        return jsonify({"error": "Run not found"}), 404
    return jsonify(bench_service.public_run(run_record))


@bp.post("/runs/<run_id>/vote")
def vote(run_id: str):
    """Record the winning label. Body: {label}. Voting reveals identities."""
    body = request.get_json(silent=True) or {}
    label = (body.get("label") or "").strip()
    if not label:
        return jsonify({"error": "label is required"}), 400

    try:
        run_record = bench_service.record_vote(run_id, label)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if run_record is None:
        return jsonify({"error": "Run not found"}), 404
    return jsonify(bench_service.public_run(run_record))


@bp.post("/runs/<run_id>/reveal")
def reveal(run_id: str):
    run_record = bench_service.reveal(run_id)
    if run_record is None:
        return jsonify({"error": "Run not found"}), 404
    return jsonify(bench_service.public_run(run_record))


@bp.get("/providers")
def providers():
    """Which providers have an API key configured (for the UI model picker)."""
    return jsonify(available_providers())


@bp.get("/budget")
def budget():
    return jsonify(bench_budget.get_budget_status())
