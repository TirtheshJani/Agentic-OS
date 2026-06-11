"""
CRM client spine — Google Sheet backed.

Stores clients (and, in later slices, deals) in a single Google Sheet, read and
written via the gws CLI. Mirrors the invoicing integration's gws usage but, unlike
invoicing, this service writes back (append + range update).

Sheet layout:
    Tab "Clients" — header row 1, one client per row from row 2:
        client_id | name | company | type | currency | hst_applicable |
        email | sector | status | notes | created
    Tab "Deals"   — header row 1, one deal per row from row 2:
        deal_id | client_id | title | stage | value | currency | probability |
        source | next_action | next_action_date | created | closed

Conventions:
  - `type` is the billing basis and drives currency + HST defaults:
        "US" -> currency USD, hst_applicable FALSE (cross-border, matches invoicing)
        "ON" -> currency CAD, hst_applicable TRUE  (Ontario / Canada, 13% HST)
    Callers may override currency explicitly; type only supplies defaults on create.
  - client_id is a short opaque id ("cl-xxxxxxxx"); never reused.
  - status is one of: prospect | active | churned.
"""

from __future__ import annotations

import json
import uuid
from datetime import date

from app.config import CRM_SHEET_ID
from app.services import gws_service

# Column order for the Clients tab. Index in this list == column index (A=0).
CLIENT_COLUMNS = [
    "client_id", "name", "company", "type", "currency", "hst_applicable",
    "email", "sector", "status", "notes", "created",
]
_CLIENTS_TAB = "Clients"
_DEALS_TAB = "Deals"
# A1 read window — far more rows than a solo consultancy will reach.
_CLIENTS_RANGE = f"{_CLIENTS_TAB}!A1:K2000"
_DEALS_RANGE = f"{_DEALS_TAB}!A1:L2000"

_VALID_TYPES = {"US", "ON"}
_VALID_STATUS = {"prospect", "active", "churned"}

# Deal headers seeded at setup so Slice 2 only needs to add read/write logic.
_DEAL_COLUMNS = [
    "deal_id", "client_id", "title", "stage", "value", "currency",
    "probability", "source", "next_action", "next_action_date", "created", "closed",
]

# Pipeline stages in board order. Won/Lost are terminal (closed) stages.
DEAL_STAGES = ["New", "Qualified", "Proposal", "Won", "Lost"]
_CLOSED_STAGES = {"Won", "Lost"}
# Default win probability (%) per stage; applied on create / stage move unless
# the caller supplies an explicit probability.
_STAGE_PROBABILITY = {
    "New": 10,
    "Qualified": 30,
    "Proposal": 60,
    "Won": 100,
    "Lost": 0,
}


# ---------------------------------------------------------------------------
# gws helpers
# ---------------------------------------------------------------------------

def _gws_json(args: list[str]) -> dict:
    """Run a gws command expecting JSON on stdout. Raises RuntimeError on failure."""
    result = gws_service.run_command(args, source="crm")
    if result["returncode"] != 0:
        stderr = (result.get("stderr") or "").strip()
        if "auth" in stderr.lower():
            raise RuntimeError(
                "GWS auth error — re-run `gws auth login` on the host to refresh credentials."
            )
        raise RuntimeError(stderr or "gws command failed")
    stdout = result.get("stdout") or ""
    brace = stdout.find("{")
    if brace == -1:
        raise RuntimeError("gws returned no JSON output")
    try:
        return json.loads(stdout[brace:])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"could not parse gws JSON output: {exc}") from exc


def _read_range(spreadsheet_id: str, a1_range: str) -> list[list[str]]:
    data = _gws_json([
        "sheets", "+read",
        "--spreadsheet", spreadsheet_id,
        "--range", a1_range,
        "--format", "json",
    ])
    if "error" in data:
        raise RuntimeError(str(data["error"]))
    return data.get("values", []) or []


def _append_row(spreadsheet_id: str, tab: str, values: list[str]) -> None:
    # NB: the `+append` helper always targets the first sheet and ignores the
    # tab, so we use the raw values.append API with an explicit range. The range
    # is only used to locate the table to append below — the row lands in `tab`.
    a1_range = f"{tab}!A1"
    data = _gws_json([
        "sheets", "spreadsheets", "values", "append",
        "--params", json.dumps({
            "spreadsheetId": spreadsheet_id,
            "range": a1_range,
            "valueInputOption": "RAW",
            "insertDataOption": "INSERT_ROWS",
        }),
        "--json", json.dumps({"range": a1_range, "values": [values]}),
        "--format", "json",
    ])
    if "error" in data:
        raise RuntimeError(str(data["error"]))


def _update_row(spreadsheet_id: str, a1_range: str, values: list[str]) -> None:
    data = _gws_json([
        "sheets", "spreadsheets", "values", "update",
        "--params", json.dumps({
            "spreadsheetId": spreadsheet_id,
            "range": a1_range,
            "valueInputOption": "RAW",
        }),
        "--json", json.dumps({"range": a1_range, "values": [values]}),
        "--format", "json",
    ])
    if "error" in data:
        raise RuntimeError(str(data["error"]))


# ---------------------------------------------------------------------------
# Config / setup
# ---------------------------------------------------------------------------

def configured_sheet_id() -> str | None:
    return (CRM_SHEET_ID or "").strip() or None


def _require_sheet_id(override: str | None = None) -> str:
    sid = (override or "").strip() or configured_sheet_id()
    if not sid:
        raise RuntimeError(
            "No CRM spreadsheet configured. Set CRM_SHEET_ID in backend/.env "
            "or call POST /api/crm/setup to create one."
        )
    return sid


def create_spreadsheet(title: str = "CCC CRM") -> dict:
    """Create a new CRM spreadsheet with Clients + Deals tabs and header rows.

    Returns {"spreadsheet_id", "url"}. The caller is responsible for persisting
    the id into CRM_SHEET_ID.
    """
    created = _gws_json([
        "sheets", "spreadsheets", "create",
        "--json", json.dumps({
            "properties": {"title": title},
            "sheets": [
                {"properties": {"title": _CLIENTS_TAB}},
                {"properties": {"title": _DEALS_TAB}},
            ],
        }),
        "--format", "json",
    ])
    if "error" in created:
        raise RuntimeError(str(created["error"]))
    sid = created.get("spreadsheetId")
    if not sid:
        raise RuntimeError("gws did not return a spreadsheetId")
    # Seed header rows.
    _update_row(sid, f"{_CLIENTS_TAB}!A1:K1", CLIENT_COLUMNS)
    _update_row(sid, f"{_DEALS_TAB}!A1:L1", _DEAL_COLUMNS)
    return {
        "spreadsheet_id": sid,
        "url": created.get("spreadsheetUrl") or f"https://docs.google.com/spreadsheets/d/{sid}",
    }


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _cell(row: list, idx: int) -> str:
    return str(row[idx]).strip() if idx < len(row) and row[idx] is not None else ""


def _row_to_client(row: list[str]) -> dict:
    client = {col: _cell(row, i) for i, col in enumerate(CLIENT_COLUMNS)}
    client["hst_applicable"] = _cell(row, CLIENT_COLUMNS.index("hst_applicable")).upper() == "TRUE"
    return client


def _client_to_row(client: dict) -> list[str]:
    row = []
    for col in CLIENT_COLUMNS:
        val = client.get(col, "")
        if col == "hst_applicable":
            val = "TRUE" if val else "FALSE"
        row.append("" if val is None else str(val))
    return row


def _defaults_for_type(client_type: str) -> tuple[str, bool]:
    """Return (currency, hst_applicable) defaults for a billing type."""
    if client_type == "ON":
        return "CAD", True
    return "USD", False  # US / default


# ---------------------------------------------------------------------------
# Public API — Clients
# ---------------------------------------------------------------------------

def list_clients(spreadsheet_id: str | None = None) -> list[dict]:
    sid = _require_sheet_id(spreadsheet_id)
    rows = _read_range(sid, _CLIENTS_RANGE)
    if not rows:
        return []
    # Skip header row; ignore blank rows (no client_id).
    return [_row_to_client(r) for r in rows[1:] if _cell(r, 0)]


def _find_row_index(rows: list[list[str]], client_id: str) -> int | None:
    """Return the 1-based sheet row number for client_id, or None. Row 1 is header."""
    for i, row in enumerate(rows):
        if _cell(row, 0) == client_id:
            return i + 1  # rows[0] is sheet row 1
    return None


def get_client(client_id: str, spreadsheet_id: str | None = None) -> dict | None:
    sid = _require_sheet_id(spreadsheet_id)
    rows = _read_range(sid, _CLIENTS_RANGE)
    for row in rows[1:]:
        if _cell(row, 0) == client_id:
            return _row_to_client(row)
    return None


def create_client(payload: dict, spreadsheet_id: str | None = None) -> dict:
    sid = _require_sheet_id(spreadsheet_id)

    name = (payload.get("name") or "").strip()
    if not name:
        raise ValueError("name is required")

    client_type = (payload.get("type") or "US").strip().upper()
    if client_type not in _VALID_TYPES:
        raise ValueError(f"type must be one of {sorted(_VALID_TYPES)}")

    status = (payload.get("status") or "prospect").strip().lower()
    if status not in _VALID_STATUS:
        raise ValueError(f"status must be one of {sorted(_VALID_STATUS)}")

    def_currency, def_hst = _defaults_for_type(client_type)
    currency = (payload.get("currency") or def_currency).strip().upper()
    hst = payload.get("hst_applicable")
    hst = def_hst if hst is None else bool(hst)

    client = {
        "client_id": f"cl-{uuid.uuid4().hex[:8]}",
        "name": name,
        "company": (payload.get("company") or "").strip(),
        "type": client_type,
        "currency": currency,
        "hst_applicable": hst,
        "email": (payload.get("email") or "").strip(),
        "sector": (payload.get("sector") or "").strip(),
        "status": status,
        "notes": (payload.get("notes") or "").strip(),
        "created": date.today().isoformat(),
    }
    _append_row(sid, _CLIENTS_TAB, _client_to_row(client))
    return client


def update_client(client_id: str, payload: dict, spreadsheet_id: str | None = None) -> dict:
    sid = _require_sheet_id(spreadsheet_id)
    rows = _read_range(sid, _CLIENTS_RANGE)
    row_num = _find_row_index(rows, client_id)
    if row_num is None:
        raise KeyError(client_id)

    existing = _row_to_client(rows[row_num - 1])

    # Apply editable fields; client_id and created are immutable.
    for field in ("name", "company", "email", "sector", "notes"):
        if field in payload and payload[field] is not None:
            existing[field] = str(payload[field]).strip()

    if payload.get("type"):
        client_type = str(payload["type"]).strip().upper()
        if client_type not in _VALID_TYPES:
            raise ValueError(f"type must be one of {sorted(_VALID_TYPES)}")
        existing["type"] = client_type

    if payload.get("status"):
        status = str(payload["status"]).strip().lower()
        if status not in _VALID_STATUS:
            raise ValueError(f"status must be one of {sorted(_VALID_STATUS)}")
        existing["status"] = status

    if payload.get("currency"):
        existing["currency"] = str(payload["currency"]).strip().upper()

    if "hst_applicable" in payload and payload["hst_applicable"] is not None:
        existing["hst_applicable"] = bool(payload["hst_applicable"])

    a1_range = f"{_CLIENTS_TAB}!A{row_num}:K{row_num}"
    _update_row(sid, a1_range, _client_to_row(existing))
    return existing


# ---------------------------------------------------------------------------
# Parsing — Deals
# ---------------------------------------------------------------------------

def _to_float(raw: str) -> float:
    """Parse a sheet cell into a float; blank / unparsable -> 0.0."""
    s = (raw or "").strip().replace(",", "").replace("$", "")
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def _row_to_deal(row: list[str]) -> dict:
    deal = {col: _cell(row, i) for i, col in enumerate(_DEAL_COLUMNS)}
    deal["value"] = _to_float(deal["value"])
    deal["probability"] = int(round(_to_float(deal["probability"])))
    return deal


def _deal_to_row(deal: dict) -> list[str]:
    row = []
    for col in _DEAL_COLUMNS:
        val = deal.get(col, "")
        row.append("" if val is None else str(val))
    return row


def _normalize_stage(raw: str | None) -> str:
    """Map a (case-insensitive) stage string onto a canonical stage name."""
    s = (raw or "").strip()
    for stage in DEAL_STAGES:
        if stage.lower() == s.lower():
            return stage
    raise ValueError(f"stage must be one of {DEAL_STAGES}")


# ---------------------------------------------------------------------------
# Public API — Deals
# ---------------------------------------------------------------------------

def list_deals(spreadsheet_id: str | None = None) -> list[dict]:
    sid = _require_sheet_id(spreadsheet_id)
    rows = _read_range(sid, _DEALS_RANGE)
    if not rows:
        return []
    # Skip header row; ignore blank rows (no deal_id).
    return [_row_to_deal(r) for r in rows[1:] if _cell(r, 0)]


def _find_deal_row_index(rows: list[list[str]], deal_id: str) -> int | None:
    """Return the 1-based sheet row number for deal_id, or None. Row 1 is header."""
    for i, row in enumerate(rows):
        if _cell(row, 0) == deal_id:
            return i + 1
    return None


def create_deal(payload: dict, spreadsheet_id: str | None = None) -> dict:
    sid = _require_sheet_id(spreadsheet_id)

    title = (payload.get("title") or "").strip()
    if not title:
        raise ValueError("title is required")

    client_id = (payload.get("client_id") or "").strip()
    if not client_id:
        raise ValueError("client_id is required")

    # Resolve the client so we can default currency from its billing type and
    # reject deals against unknown clients.
    client = get_client(client_id, sid)
    if client is None:
        raise ValueError(f"unknown client_id: {client_id}")

    stage = _normalize_stage(payload.get("stage") or "New")

    currency = (payload.get("currency") or client.get("currency") or "USD").strip().upper()

    prob = payload.get("probability")
    probability = _STAGE_PROBABILITY[stage] if prob is None else int(round(_to_float(str(prob))))
    probability = max(0, min(100, probability))

    today = date.today().isoformat()
    deal = {
        "deal_id": f"dl-{uuid.uuid4().hex[:8]}",
        "client_id": client_id,
        "title": title,
        "stage": stage,
        "value": _to_float(str(payload.get("value", 0))),
        "currency": currency,
        "probability": probability,
        "source": (payload.get("source") or "").strip(),
        "next_action": (payload.get("next_action") or "").strip(),
        "next_action_date": (payload.get("next_action_date") or "").strip(),
        "created": today,
        "closed": today if stage in _CLOSED_STAGES else "",
    }
    _append_row(sid, _DEALS_TAB, _deal_to_row(deal))
    return deal


def update_deal(deal_id: str, payload: dict, spreadsheet_id: str | None = None) -> dict:
    sid = _require_sheet_id(spreadsheet_id)
    rows = _read_range(sid, _DEALS_RANGE)
    row_num = _find_deal_row_index(rows, deal_id)
    if row_num is None:
        raise KeyError(deal_id)

    existing = _row_to_deal(rows[row_num - 1])
    stage_supplied = bool(payload.get("stage"))

    # Plain text fields.
    for field in ("title", "source", "next_action", "next_action_date"):
        if field in payload and payload[field] is not None:
            existing[field] = str(payload[field]).strip()

    if payload.get("client_id"):
        existing["client_id"] = str(payload["client_id"]).strip()

    if payload.get("currency"):
        existing["currency"] = str(payload["currency"]).strip().upper()

    if "value" in payload and payload["value"] is not None:
        existing["value"] = _to_float(str(payload["value"]))

    if stage_supplied:
        new_stage = _normalize_stage(payload["stage"])
        existing["stage"] = new_stage
        # Default probability to the new stage unless explicitly overridden.
        if payload.get("probability") is None:
            existing["probability"] = _STAGE_PROBABILITY[new_stage]
        # Stamp / clear the closed date as the deal enters or leaves a terminal stage.
        if new_stage in _CLOSED_STAGES:
            if not existing.get("closed"):
                existing["closed"] = date.today().isoformat()
        else:
            existing["closed"] = ""

    if payload.get("probability") is not None:
        prob = max(0, min(100, int(round(_to_float(str(payload["probability"]))))))
        existing["probability"] = prob

    a1_range = f"{_DEALS_TAB}!A{row_num}:L{row_num}"
    _update_row(sid, a1_range, _deal_to_row(existing))
    return existing


def move_deal_stage(deal_id: str, stage: str, spreadsheet_id: str | None = None) -> dict:
    """Convenience wrapper for a pure stage change (kanban drag)."""
    return update_deal(deal_id, {"stage": stage}, spreadsheet_id)


def pipeline_summary(spreadsheet_id: str | None = None) -> dict:
    """Total and weighted (value × probability) pipeline value per stage.

    Values are grouped by currency since a solo consultancy may bill in both
    USD and CAD; mixing them into one number would be meaningless. Returns:
        {
          "stages": [{"stage", "count", "value": {CUR: n}, "weighted": {CUR: n}}],
          "totals": {"value": {CUR: n}, "weighted": {CUR: n}, "count": n},
        }
    """
    deals = list_deals(spreadsheet_id)

    def _empty_stage(stage: str) -> dict:
        return {"stage": stage, "count": 0, "value": {}, "weighted": {}}

    stages = {s: _empty_stage(s) for s in DEAL_STAGES}
    totals_value: dict[str, float] = {}
    totals_weighted: dict[str, float] = {}
    total_count = 0

    for deal in deals:
        stage = deal["stage"] if deal["stage"] in stages else None
        if stage is None:
            continue
        cur = (deal.get("currency") or "USD").upper()
        value = float(deal.get("value") or 0)
        weighted = value * (float(deal.get("probability") or 0) / 100.0)

        bucket = stages[stage]
        bucket["count"] += 1
        bucket["value"][cur] = bucket["value"].get(cur, 0.0) + value
        bucket["weighted"][cur] = bucket["weighted"].get(cur, 0.0) + weighted

        totals_value[cur] = totals_value.get(cur, 0.0) + value
        totals_weighted[cur] = totals_weighted.get(cur, 0.0) + weighted
        total_count += 1

    # Round to cents for stable JSON.
    def _round(d: dict[str, float]) -> dict[str, float]:
        return {k: round(v, 2) for k, v in d.items()}

    stage_list = []
    for s in DEAL_STAGES:
        b = stages[s]
        stage_list.append({
            "stage": s,
            "count": b["count"],
            "value": _round(b["value"]),
            "weighted": _round(b["weighted"]),
        })

    return {
        "stages": stage_list,
        "totals": {
            "value": _round(totals_value),
            "weighted": _round(totals_weighted),
            "count": total_count,
        },
    }
