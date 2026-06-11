"""
Sheet → Invoice integration.

Reads a Google Sheet tab (one tab per billing cycle / invoice) via the gws CLI,
parses its line items (Qty / Unit (USD) / Total (USD)), and creates an invoice in
the BMO bookkeeper service (Flask app on :5223, see ~/Documents/bmo-bookkeeper).

Sheet layout (per tab), as configured by the user:
    Row 1   : title          e.g. "2026 Billing Cycle 9"
    Row 2   : header          ["", "Qty", "Unit (USD)", "Total (USD)", "Issued invoice", "Paid"]
    Row 3+  : line items       [description, qty, unit, total, issued, paid]
    last    : totals row       ["", "", "", <grand total>]

Decisions (locked with the user):
  - currency is always USD  → hst_rate 0.0, bookkeeper posts revenue to COA 4100.
  - client_name is derived from the first line item's description (date range stripped).
  - invoice_date is supplied by the caller (UI defaults to today).
  - read-only: the sheet is never written back.
  - flow: create draft invoice, then issue it (posts the journal entry).
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from datetime import date

from app.config import BOOKKEEPER_BASE_URL
from app.services import gws_service

# A1 read window per tab. 60 rows is far more than any single invoice needs.
_READ_RANGE = "A1:F60"

# Strips a trailing date range from a line-item description so we can derive a
# client name. Matches the first "- <m>/<d>" style date that follows the name,
# e.g. "IFS Consulting Services- 4/19/2026 - 5/2/2026" → "IFS Consulting Services".
_DATE_TAIL_RE = re.compile(r"\s*-\s*\d{1,2}/\d{1,2}.*$")


# ---------------------------------------------------------------------------
# gws helpers
# ---------------------------------------------------------------------------

def _gws_json(args: list[str]) -> dict:
    """Run a gws command expecting JSON on stdout. Raises RuntimeError on failure."""
    result = gws_service.run_command(args, source="invoicing")
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


def list_tabs(spreadsheet_id: str) -> list[dict]:
    """Return the spreadsheet's tabs as [{title, gid, rows, cols}], in sheet order."""
    data = _gws_json([
        "sheets", "spreadsheets", "get",
        "--params", json.dumps({"spreadsheetId": spreadsheet_id}),
        "--format", "json",
    ])
    if "error" in data:
        raise RuntimeError(str(data["error"]))
    tabs = []
    for sheet in data.get("sheets", []):
        props = sheet.get("properties", {})
        grid = props.get("gridProperties", {})
        tabs.append({
            "title": props.get("title"),
            "gid": props.get("sheetId"),
            "rows": grid.get("rowCount"),
            "cols": grid.get("columnCount"),
        })
    return tabs


def _read_tab(spreadsheet_id: str, tab: str) -> list[list[str]]:
    data = _gws_json([
        "sheets", "+read",
        "--spreadsheet", spreadsheet_id,
        "--range", f"{tab}!{_READ_RANGE}",
        "--format", "json",
    ])
    if "error" in data:
        raise RuntimeError(str(data["error"]))
    return data.get("values", []) or []


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _to_number(value) -> float | None:
    if value is None:
        return None
    s = str(value).strip().replace("$", "").replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _cell(row: list, idx: int) -> str:
    return str(row[idx]).strip() if idx < len(row) and row[idx] is not None else ""


def parse_tab(spreadsheet_id: str, tab: str) -> dict:
    """
    Parse a single tab into an invoice preview:
        { title, client_name, line_items: [{description, qty, unit, total}],
          subtotal, currency, issued, sheet_total }
    """
    rows = _read_tab(spreadsheet_id, tab)
    if not rows:
        raise RuntimeError(f"Tab '{tab}' is empty")

    title = _cell(rows[0], 0) or tab

    # Locate the header row (contains "Qty" + a "Unit" column).
    header_idx = None
    for i, row in enumerate(rows):
        lowered = [c.lower() for c in (str(x) for x in row)]
        if any(c == "qty" for c in lowered) and any("unit" in c for c in lowered):
            header_idx = i
            break
    if header_idx is None:
        raise RuntimeError(
            f"Tab '{tab}' has no recognizable header row (expected a 'Qty' / 'Unit (USD)' row)"
        )

    line_items: list[dict] = []
    issued = ""
    sheet_total: float | None = None

    for row in rows[header_idx + 1:]:
        description = _cell(row, 0)
        qty = _to_number(row[1] if len(row) > 1 else None)
        unit = _to_number(row[2] if len(row) > 2 else None)
        total = _to_number(row[3] if len(row) > 3 else None)
        issued_cell = _cell(row, 4)
        if issued_cell and not issued:
            issued = issued_cell

        # Totals row: no description but a total value → record grand total, skip.
        if not description:
            if total is not None:
                sheet_total = total
            continue

        if total is None and qty is not None and unit is not None:
            total = round(qty * unit, 2)
        if total is None:
            # A descriptive row with no monetary value (e.g. a note) — skip it.
            continue

        line_items.append({
            "description": description,
            "qty": qty,
            "unit": unit,
            "total": total,
        })

    if not line_items:
        raise RuntimeError(f"Tab '{tab}' has no line items with amounts")

    subtotal = round(sum(item["total"] for item in line_items), 2)
    client_name = _DATE_TAIL_RE.sub("", line_items[0]["description"]).strip()

    return {
        "title": title,
        "client_name": client_name,
        "line_items": line_items,
        "subtotal": subtotal,
        "currency": "USD",
        "issued": issued,
        "sheet_total": sheet_total,
    }


def _build_notes(parsed: dict, tab: str) -> str:
    lines = [f"Source: Google Sheet tab '{tab}' — {parsed['title']}"]
    for item in parsed["line_items"]:
        qty = item["qty"]
        unit = item["unit"]
        if qty is not None and unit is not None:
            lines.append(f"{qty:g} × ${unit:,.2f} = ${item['total']:,.2f} — {item['description']}")
        else:
            lines.append(f"${item['total']:,.2f} — {item['description']}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Bookkeeper HTTP
# ---------------------------------------------------------------------------

def _bookkeeper(path: str, payload: dict | None = None, method: str = "POST") -> dict:
    url = f"{BOOKKEEPER_BASE_URL.rstrip('/')}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        try:
            detail = json.loads(detail).get("error", detail)
        except (json.JSONDecodeError, AttributeError):
            pass
        raise RuntimeError(f"Bookkeeper {path} returned {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Cannot reach bookkeeper at {BOOKKEEPER_BASE_URL} ({exc.reason}). "
            "Is the bmo-bookkeeper container running and reachable?"
        ) from exc


def create_invoice(
    spreadsheet_id: str,
    tab: str,
    invoice_date: str | None = None,
    client_name: str | None = None,
    issue: bool = True,
) -> dict:
    """
    Parse a tab, create a draft USD invoice in the bookkeeper, and (optionally) issue it.

    Returns { invoice, issued, parsed }.
    """
    parsed = parse_tab(spreadsheet_id, tab)

    inv_date = invoice_date or date.today().isoformat()
    # Validate the date format early so the error is ours, not the bookkeeper's.
    try:
        date.fromisoformat(inv_date)
    except ValueError as exc:
        raise RuntimeError("invoice_date must be YYYY-MM-DD") from exc

    payload = {
        "client_name": (client_name or parsed["client_name"]).strip(),
        "invoice_date": inv_date,
        "subtotal": parsed["subtotal"],
        "currency": "USD",
        "hst_rate": 0.0,
        "notes": _build_notes(parsed, tab),
    }
    if not payload["client_name"]:
        raise RuntimeError("Could not determine a client name; pass client_name explicitly.")

    invoice = _bookkeeper("/invoices", payload, method="POST")
    invoice_id = invoice.get("id")

    issued = False
    if issue and invoice_id is not None:
        invoice = _bookkeeper(f"/invoices/{invoice_id}/issue", method="POST")
        issued = invoice.get("status") == "issued"

    return {"invoice": invoice, "issued": issued, "parsed": parsed}
