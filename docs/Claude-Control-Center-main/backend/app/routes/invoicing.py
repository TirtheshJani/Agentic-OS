"""Invoicing routes — Google Sheet → BMO bookkeeper invoice creation."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.config import INVOICING_SHEET_ID
from app.services import invoicing_service

bp = Blueprint("invoicing", __name__, url_prefix="/api/invoicing")


def _spreadsheet_id() -> str | None:
    return (request.args.get("spreadsheet") or INVOICING_SHEET_ID or "").strip() or None


@bp.route("/config", methods=["GET"])
def get_config():
    """Expose the default spreadsheet id so the UI can prefill it."""
    return jsonify({"default_spreadsheet_id": INVOICING_SHEET_ID})


@bp.route("/tabs", methods=["GET"])
def list_tabs():
    spreadsheet_id = _spreadsheet_id()
    if not spreadsheet_id:
        return jsonify({"error": "spreadsheet id is required"}), 400
    try:
        return jsonify({"spreadsheet_id": spreadsheet_id, "tabs": invoicing_service.list_tabs(spreadsheet_id)})
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


@bp.route("/preview", methods=["GET"])
def preview():
    spreadsheet_id = _spreadsheet_id()
    tab = (request.args.get("tab") or "").strip()
    if not spreadsheet_id or not tab:
        return jsonify({"error": "spreadsheet id and tab are required"}), 400
    try:
        return jsonify(invoicing_service.parse_tab(spreadsheet_id, tab))
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


@bp.route("/create", methods=["POST"])
def create():
    data = request.get_json(force=True, silent=True) or {}
    spreadsheet_id = (data.get("spreadsheet") or INVOICING_SHEET_ID or "").strip()
    tab = (data.get("tab") or "").strip()
    if not spreadsheet_id or not tab:
        return jsonify({"error": "spreadsheet and tab are required"}), 400
    try:
        result = invoicing_service.create_invoice(
            spreadsheet_id=spreadsheet_id,
            tab=tab,
            invoice_date=data.get("invoice_date"),
            client_name=data.get("client_name"),
            issue=bool(data.get("issue", True)),
        )
        return jsonify(result), 201
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
