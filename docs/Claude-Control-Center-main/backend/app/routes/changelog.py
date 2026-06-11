import re
import time

import httpx
from flask import Blueprint, jsonify

bp = Blueprint("changelog", __name__, url_prefix="/api/changelog")

_CACHE: dict = {}
_TTL = 3600  # 1 hour

_CHANGELOG_MD_URL = "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md"
_WHATS_NEW_URL = "https://code.claude.com/docs/en/whats-new"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cached(key: str, fetch_fn):
    now = time.time()
    entry = _CACHE.get(key)
    if entry and now - entry["ts"] < _TTL:
        return entry["data"]
    data = fetch_fn()
    _CACHE[key] = {"ts": now, "data": data}
    return data


def _invalidate(key: str):
    _CACHE.pop(key, None)


# ---------------------------------------------------------------------------
# Changelog (GitHub raw markdown)
# ---------------------------------------------------------------------------

def _parse_changelog_md(text: str) -> list:
    """Parse CHANGELOG.md into [{version, items}] in newest-first order."""
    entries: list[dict] = []
    current: dict | None = None

    for line in text.splitlines():
        if line.startswith("## "):
            if current:
                entries.append(current)
            current = {"version": line[3:].strip(), "items": []}
        elif current is not None:
            stripped = line.strip()
            if stripped.startswith("- "):
                current["items"].append(stripped[2:])
            elif stripped.startswith("* "):
                current["items"].append(stripped[2:])

    if current:
        entries.append(current)

    return entries


def _fetch_releases() -> list | dict:
    try:
        resp = httpx.get(_CHANGELOG_MD_URL, timeout=15, follow_redirects=True, headers=_HEADERS)
        resp.raise_for_status()
        return _parse_changelog_md(resp.text)
    except Exception as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# What's New (HTML scrape)
# ---------------------------------------------------------------------------

def _clean_content_html(raw: str) -> str:
    """Return sanitised inner HTML keeping only safe semantic tags."""
    # Convert span[data-as=p] → <p>
    raw = re.sub(r'<span[^>]*data-as="p"[^>]*>', "<p>", raw)
    raw = re.sub(r'</span>', "</p>", raw)

    # Strip attributes from safe tags (keep href on <a>)
    raw = re.sub(r'<(strong|em|code|ul|ol|li|p|br)(?:\s[^>]*)?>',
                 lambda m: f"<{m.group(1)}>", raw)
    raw = re.sub(r'<a\s[^>]*href="([^"]*)"[^>]*>', r'<a href="\1" target="_blank">', raw)

    # Drop all other tags (nav artifacts, divs, svgs, etc.)
    raw = re.sub(r'<(?!/?(?:strong|em|code|a|ul|ol|li|p|br)\b)[^>]+>', "", raw)

    # Decode common entities left as-is
    raw = raw.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    raw = raw.replace("&quot;", '"').replace("&#x27;", "'").replace("&ndash;", "–")
    raw = raw.replace("&#39;", "'").replace("&ldquo;", "\u201c").replace("&rdquo;", "\u201d")

    # Collapse blank lines
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    return raw.strip()


def _parse_whats_new_html(content: str) -> list:
    """Extract week entries from the id=content section of whats-new."""
    # Split at each week block
    blocks = re.split(r'(?=<div[^>]+id="week-\d+")', content)
    entries: list[dict] = []

    for block in blocks:
        id_m = re.search(r'id="(week-(\d+))"', block)
        if not id_m:
            continue

        entry_id = id_m.group(1)
        week_num = int(id_m.group(2))

        label_m = re.search(r'data-component-part="update-label"[^>]*>([^<]+)', block)
        label = label_m.group(1).strip() if label_m else entry_id

        date_m = re.search(r'data-component-part="update-description"[^>]*>(.*?)</div>',
                            block, re.DOTALL)
        date_raw = date_m.group(1) if date_m else ""
        date = re.sub(r'<[^>]+>', "", date_raw).strip()
        # fix HTML entity for dashes
        date = date.replace("&ndash;", "–").replace("&#8211;", "–")

        tags = re.findall(r'data-component-part="update-tag"[^>]*>([^<]+)', block)

        content_m = re.search(
            r'data-component-part="update-content"[^>]*>(.*)',
            block, re.DOTALL
        )
        content_html = _clean_content_html(content_m.group(1)) if content_m else ""

        entries.append({
            "id": entry_id,
            "week": week_num,
            "label": label,
            "date": date,
            "tags": [t.strip() for t in tags],
            "content": content_html,
        })

    return entries


def _fetch_whats_new() -> list | dict:
    try:
        resp = httpx.get(_WHATS_NEW_URL, timeout=15, follow_redirects=True, headers=_HEADERS)
        resp.raise_for_status()
        html = resp.text

        content_m = re.search(r'id="content"[^>]*>(.*?)(?=</article|<footer)', html, re.DOTALL)
        if not content_m:
            return {"error": "Could not locate content section in page"}

        return _parse_whats_new_html(content_m.group(1))
    except Exception as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@bp.get("/releases")
def get_releases():
    return jsonify(_cached("releases", _fetch_releases))


@bp.post("/releases/refresh")
def refresh_releases():
    _invalidate("releases")
    return jsonify(_cached("releases", _fetch_releases))


@bp.get("/whats-new")
def get_whats_new():
    return jsonify(_cached("whats_new", _fetch_whats_new))


@bp.post("/whats-new/refresh")
def refresh_whats_new():
    _invalidate("whats_new")
    return jsonify(_cached("whats_new", _fetch_whats_new))
