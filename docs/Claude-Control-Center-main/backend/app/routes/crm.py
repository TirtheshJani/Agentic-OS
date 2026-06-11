"""CRM routes — Google Sheet backed client spine.

Slice 1: Clients CRUD.
Slice 2: Deals + pipeline (kanban).
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services import crm_service

bp = Blueprint("crm", __name__, url_prefix="/api/crm")


def _spreadsheet_id() -> str | None:
    return (request.args.get("spreadsheet") or "").strip() or None


@bp.route("/config", methods=["GET"])
def get_config():
    """Expose whether a CRM spreadsheet is configured (drives the setup prompt)."""
    sid = crm_service.configured_sheet_id()
    return jsonify({"spreadsheet_id": sid, "configured": bool(sid)})


@bp.route("/setup", methods=["POST"])
def setup():
    """Create a new CRM spreadsheet with Clients + Deals tabs.

    Returns the new spreadsheet id/url. The id must still be persisted into
    CRM_SHEET_ID (backend/.env) to become the default.
    """
    data = request.get_json(force=True, silent=True) or {}
    title = (data.get("title") or "CCC CRM").strip() or "CCC CRM"
    try:
        return jsonify(crm_service.create_spreadsheet(title)), 201
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


@bp.route("/clients", methods=["GET"])
def list_clients():
    try:
        return jsonify({"clients": crm_service.list_clients(_spreadsheet_id())})
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


@bp.route("/clients", methods=["POST"])
def create_client():
    data = request.get_json(force=True, silent=True) or {}
    try:
        return jsonify(crm_service.create_client(data, _spreadsheet_id())), 201
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


@bp.route("/clients/<client_id>", methods=["GET"])
def get_client(client_id: str):
    try:
        client = crm_service.get_client(client_id, _spreadsheet_id())
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
    if client is None:
        return jsonify({"error": "client not found"}), 404
    return jsonify(client)


@bp.route("/clients/<client_id>", methods=["PATCH", "PUT"])
def update_client(client_id: str):
    data = request.get_json(force=True, silent=True) or {}
    try:
        return jsonify(crm_service.update_client(client_id, data, _spreadsheet_id()))
    except KeyError:
        return jsonify({"error": "client not found"}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


# ---------------------------------------------------------------------------
# Deals + pipeline (Slice 2)
# ---------------------------------------------------------------------------

@bp.route("/deals", methods=["GET"])
def list_deals():
    try:
        return jsonify({"deals": crm_service.list_deals(_spreadsheet_id())})
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


@bp.route("/deals", methods=["POST"])
def create_deal():
    data = request.get_json(force=True, silent=True) or {}
    try:
        return jsonify(crm_service.create_deal(data, _spreadsheet_id())), 201
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


@bp.route("/deals/<deal_id>", methods=["PATCH", "PUT"])
def update_deal(deal_id: str):
    data = request.get_json(force=True, silent=True) or {}
    try:
        return jsonify(crm_service.update_deal(deal_id, data, _spreadsheet_id()))
    except KeyError:
        return jsonify({"error": "deal not found"}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


@bp.route("/pipeline", methods=["GET"])
def pipeline():
    try:
        return jsonify(crm_service.pipeline_summary(_spreadsheet_id()))
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
