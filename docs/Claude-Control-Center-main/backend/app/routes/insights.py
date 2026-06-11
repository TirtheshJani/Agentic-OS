from datetime import datetime, timezone

from bs4 import BeautifulSoup
from flask import Blueprint, jsonify

from app.config import CLAUDE_DIR

bp = Blueprint("insights", __name__, url_prefix="/api/insights")

REPORT_PATH = CLAUDE_DIR / "usage-data" / "report.html"


def _text(el):
    return el.get_text(" ", strip=True) if el else ""


def _parse_report(html: str, mtime: float) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    # date range from subtitle
    subtitle = soup.select_one("p.subtitle")
    date_range = _text(subtitle)

    # stats row
    stats = []
    for stat in soup.select(".stats-row .stat"):
        value = _text(stat.select_one(".stat-value"))
        label = _text(stat.select_one(".stat-label"))
        if value or label:
            stats.append({"label": label, "value": value})

    # charts — every .chart-card
    charts = []
    for card in soup.select(".chart-card"):
        title_el = card.select_one(".chart-title")
        # strip child elements (e.g. timezone select) from title
        title = title_el.get_text(" ", strip=True) if title_el else ""
        bars = []
        for row in card.select(".bar-row"):
            label = _text(row.select_one(".bar-label"))
            val_text = _text(row.select_one(".bar-value"))
            fill_el = row.select_one(".bar-fill")
            pct = 0.0
            if fill_el and fill_el.get("style"):
                style = fill_el["style"]
                for part in style.split(";"):
                    if "width" in part:
                        try:
                            pct = float(part.split(":")[1].strip().rstrip("%"))
                        except (IndexError, ValueError):
                            pct = 0.0
            try:
                value = int(val_text)
            except ValueError:
                value = 0
            if label:
                bars.append({"label": label, "value": value, "pct": round(pct, 1)})
        if bars:
            charts.append({"title": title, "bars": bars})

    # features — .feature-card
    features = []
    for card in soup.select(".feature-card"):
        title = _text(card.select_one(".feature-title"))
        oneliner = _text(card.select_one(".feature-oneliner"))
        why = _text(card.select_one(".feature-why"))
        examples = []
        for ex in card.select(".feature-example"):
            desc = _text(ex.select_one(".example-desc"))
            code_el = ex.select_one(".example-code")
            code = code_el.get_text(strip=True) if code_el else ""
            examples.append({"desc": desc, "code": code})
        features.append({"title": title, "oneliner": oneliner, "why": why, "examples": examples})

    # patterns — .pattern-card
    patterns = []
    for card in soup.select(".pattern-card"):
        title = _text(card.select_one(".pattern-title"))
        summary = _text(card.select_one(".pattern-summary"))
        detail = _text(card.select_one(".pattern-detail"))
        prompt_el = card.select_one(".copyable-prompt")
        prompt = prompt_el.get_text(strip=True) if prompt_el else ""
        patterns.append({"title": title, "summary": summary, "detail": detail, "prompt": prompt})

    # horizon — .horizon-card
    horizon = []
    for card in soup.select(".horizon-card"):
        title = _text(card.select_one(".horizon-title"))
        possible = _text(card.select_one(".horizon-possible"))
        tip = _text(card.select_one(".horizon-tip"))
        prompt_el = card.select_one(".pattern-prompt code")
        prompt = prompt_el.get_text(strip=True) if prompt_el else ""
        horizon.append({"title": title, "possible": possible, "tip": tip, "prompt": prompt})

    report_date = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()

    return {
        "date_range": date_range,
        "report_date": report_date,
        "stats": stats,
        "charts": charts,
        "features": features,
        "patterns": patterns,
        "horizon": horizon,
    }


@bp.get("")
def get_insights():
    if not REPORT_PATH.exists():
        return jsonify({"error": "No report found. Run /insights in Claude Code to generate one."}), 404

    mtime = REPORT_PATH.stat().st_mtime
    html = REPORT_PATH.read_text(encoding="utf-8")

    data = _parse_report(html, mtime)
    return jsonify(data)
