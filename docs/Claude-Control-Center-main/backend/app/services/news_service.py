from __future__ import annotations

"""News & Information hub — on-demand aggregation of X (@ClaudeDevs), tech-news
RSS feeds and Reddit, plus LLM-generated video / learning-content ideas.

Manual-refresh only: nothing runs in the background. `refresh_feed()` and
`generate_ideas()` execute when the UI asks for them and cache results to
backend/data/news_feed.json and backend/data/news_ideas.json (atomic writes).
"""

import logging
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Untrusted RSS/XML from the network — use defusedxml to block XXE / billion-laughs.
try:
    from defusedxml import ElementTree as ET  # type: ignore
    from defusedxml.ElementTree import ParseError as _XMLParseError  # type: ignore
except ImportError:  # fallback: stdlib parser does not expand external entities by default
    from xml.etree import ElementTree as ET  # type: ignore
    from xml.etree.ElementTree import ParseError as _XMLParseError  # type: ignore

import httpx
import orjson

from app import config
from app.services import anthropic_client, firecrawl_collector, obsidian_vault_service, reddit_collector

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_FEED_FILE = _DATA_DIR / "news_feed.json"
_IDEAS_FILE = _DATA_DIR / "news_ideas.json"
_lock = threading.Lock()

_MAX_PER_SOURCE = 15
_IDEA_CONTEXT_ITEMS = 20

# Seeded into NEWS_FEEDS_CONFIG on first use. The ccc-data Docker volume shadows
# backend/data/, so we can't rely on a file shipped in the repo being visible —
# write the defaults on demand instead.
_DEFAULT_FEEDS = [
    {"name": "OpenAI News", "url": "https://openai.com/news/rss.xml", "category": "ai-blog"},
    {"name": "Google DeepMind", "url": "https://deepmind.google/blog/rss.xml", "category": "ai-blog"},
    {"name": "Hugging Face Blog", "url": "https://huggingface.co/blog/feed.xml", "category": "ai-blog"},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "category": "tech-press"},
    {"name": "The Verge AI", "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "category": "tech-press"},
    {"name": "Ars Technica AI", "url": "https://arstechnica.com/ai/feed/", "category": "tech-press"},
]


# ---------- persistence helpers ----------

def _load(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        with _lock:
            return orjson.loads(path.read_bytes())
    except Exception:
        return default


def _save(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with _lock:
        tmp.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
        os.replace(tmp, path)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_url(url: str) -> str:
    """Only allow http(s) links — block javascript:/data: etc. from untrusted feeds."""
    url = (url or "").strip()
    return url if url.lower().startswith(("http://", "https://")) else ""


def _item(source: str, *, title: str, url: str, summary: str = "",
          author: str = "", timestamp: str = "", score: int | None = None) -> dict:
    url = _safe_url(url)
    raw = f"{source}:{url}:{title}"
    return {
        "id": uuid.uuid5(uuid.NAMESPACE_URL, raw).hex,
        "source": source,
        "title": title.strip(),
        "url": url,
        "summary": (summary or "").strip()[:600],
        "author": author,
        "timestamp": timestamp,
        "score": score,
    }


# ---------- collectors ----------

def _fetch_x() -> list[dict]:
    """Scrape @ClaudeDevs posts via Firecrawl. Best-effort markdown parsing."""
    try:
        scraped = firecrawl_collector.scrape_url(config.NEWS_X_SCRAPE_URL)
    except Exception as exc:  # firecrawl not configured / installed
        logger.warning("news_service: X fetch skipped: %s", exc)
        return []
    content = scraped.get("content") or ""
    if not content:
        return []
    items: list[dict] = []
    # Treat reasonably long paragraphs as individual posts (nitter/markdown layout).
    for para in re.split(r"\n{2,}", content):
        text = re.sub(r"\s+", " ", para).strip()
        if len(text) < 40 or text.startswith(("#", "|", "![", "[")):
            continue
        title = text[:140] + ("…" if len(text) > 140 else "")
        items.append(_item(
            "x",
            title=title,
            url=config.NEWS_X_SCRAPE_URL,
            summary=text,
            author=f"@{config.NEWS_X_HANDLE}",
        ))
        if len(items) >= _MAX_PER_SOURCE:
            break
    return items


def _load_feeds_config() -> list[dict]:
    if not config.NEWS_FEEDS_CONFIG.exists():
        _save(config.NEWS_FEEDS_CONFIG, {"feeds": _DEFAULT_FEEDS})
        return list(_DEFAULT_FEEDS)
    cfg = _load(config.NEWS_FEEDS_CONFIG, {"feeds": _DEFAULT_FEEDS})
    feeds = cfg.get("feeds", []) if isinstance(cfg, dict) else []
    return feeds or list(_DEFAULT_FEEDS)


def _parse_rss(xml_text: str, feed_name: str) -> list[dict]:
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except _XMLParseError as exc:
        logger.warning("news_service: RSS parse failed for %s: %s", feed_name, exc)
        return items
    # RSS <item> and Atom <entry>. Note: an Element with no children is falsy,
    # so always compare `find(...) is not None` rather than using `or`.
    atom_ns = "{http://www.w3.org/2005/Atom}"
    entries = list(root.iter("item"))
    if not entries:
        entries = list(root.iter(f"{atom_ns}entry"))
    for node in entries:
        def _text(tag: str) -> str:
            el = node.find(tag)
            if el is None:
                el = node.find(f"{atom_ns}{tag}")
            return (el.text or "").strip() if el is not None and el.text else ""
        title = _text("title")
        link = _text("link")
        if not link:
            link_el = node.find(f"{atom_ns}link")
            if link_el is not None:
                link = link_el.get("href", "")
        summary = _text("description") or _text("summary")
        summary = re.sub(r"<[^>]+>", "", summary)
        pub = _text("pubDate") or _text("published") or _text("updated")
        if title and link:
            items.append(_item("news", title=title, url=link, summary=summary,
                               author=feed_name, timestamp=pub))
        if len(items) >= _MAX_PER_SOURCE:
            break
    return items


def _fetch_tech_news() -> list[dict]:
    feeds = _load_feeds_config()
    results: list[dict] = []
    headers = {"User-Agent": "ccc-news/1.0"}
    for feed in feeds:
        url = feed.get("url", "")
        name = feed.get("name", url)
        if not url:
            continue
        try:
            resp = httpx.get(url, headers=headers, timeout=15.0, follow_redirects=True)
            if resp.status_code >= 400:
                logger.warning("news_service: feed %s returned %s", name, resp.status_code)
                continue
            results.extend(_parse_rss(resp.text, name))
        except Exception as exc:
            logger.warning("news_service: feed fetch failed for %s: %s", name, exc)
    return results


def _fetch_reddit() -> list[dict]:
    try:
        posts = reddit_collector.hot_posts(config.NEWS_SUBREDDITS, limit=8)
    except Exception as exc:
        logger.warning("news_service: Reddit fetch skipped: %s", exc)
        return []
    items: list[dict] = []
    for p in posts:
        ts = ""
        try:
            ts = datetime.fromtimestamp(p.get("created_utc", 0), tz=timezone.utc).isoformat()
        except Exception:
            pass
        items.append(_item(
            "reddit",
            title=p.get("title", ""),
            url=p.get("permalink") or p.get("url", ""),
            summary=p.get("selftext", ""),
            author=f"r/{p.get('subreddit', '')}",
            timestamp=ts,
            score=p.get("score"),
        ))
    return items[:_MAX_PER_SOURCE]


# ---------- public API ----------

def refresh_feed() -> dict:
    """Re-fetch all streams, normalize, cache and return."""
    items: list[dict] = []
    items.extend(_fetch_x())
    items.extend(_fetch_tech_news())
    items.extend(_fetch_reddit())

    # Dedupe by id, sort newest-first (items without timestamps fall to the end).
    seen: set[str] = set()
    deduped: list[dict] = []
    for it in items:
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        deduped.append(it)
    deduped.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    feed = {"items": deduped, "refreshed_at": _now_iso()}
    _save(_FEED_FILE, feed)
    return feed


def load_feed() -> dict:
    return _load(_FEED_FILE, {"items": [], "refreshed_at": None})


def load_ideas() -> dict:
    return _load(_IDEAS_FILE, {"video": [], "learning": [], "generated_at": None})


def _extract_json(text: str) -> Any:
    """Pull the first JSON object/array out of an LLM response."""
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    candidate = fence.group(1) if fence else text
    match = re.search(r"(\{.*\}|\[.*\])", candidate, re.DOTALL)
    if not match:
        return None
    try:
        return orjson.loads(match.group(1))
    except Exception:
        return None


def generate_ideas(kinds: list[str]) -> dict:
    """Generate video / learning-content ideas from the cached feed via the LLM."""
    if not anthropic_client.has_api_key():
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    kinds = [k for k in kinds if k in ("video", "learning")] or ["video", "learning"]
    feed = load_feed()
    headlines = [
        {"source": it["source"], "title": it["title"], "summary": it.get("summary", "")[:200]}
        for it in feed.get("items", [])[:_IDEA_CONTEXT_ITEMS]
    ]
    if not headlines:
        raise RuntimeError("No feed items — refresh the feed first")

    want = " and ".join(kinds)
    prompt = (
        "You are a content strategist for a developer-focused YouTube channel about "
        "Claude, AI agents and coding tools.\n\n"
        f"Here are today's news/X/Reddit items:\n{orjson.dumps(headlines).decode()}\n\n"
        f"Propose content ideas ({want}). Respond with ONLY a JSON object of this shape:\n"
        '{"video": [{"title": "...", "hook": "...", "audience": "...", "why_now": "..."}], '
        '"learning": [{"title": "...", "format": "tutorial|course|article", "outline": "...", "level": "beginner|intermediate|advanced"}]}\n'
        "Give 3-5 items per requested kind. Only include the kinds requested: "
        f"{kinds}."
    )

    resp = anthropic_client.request(
        "POST",
        "/v1/messages",
        json={
            "model": config.NEWS_IDEA_MODEL,
            "max_tokens": 1500,
            "messages": [{"role": "user", "content": prompt}],
        },
        is_create=True,
    )
    text = "".join(
        block.get("text", "")
        for block in resp.get("content", [])
        if isinstance(block, dict) and block.get("type") == "text"
    )
    parsed = _extract_json(text) or {}

    ideas = {
        "video": parsed.get("video", []) if "video" in kinds else [],
        "learning": parsed.get("learning", []) if "learning" in kinds else [],
        "generated_at": _now_iso(),
    }
    # Tag each idea with a stable id for export/keying.
    for kind in ("video", "learning"):
        for idea in ideas[kind]:
            if isinstance(idea, dict):
                idea.setdefault("id", uuid.uuid4().hex)
                idea.setdefault("kind", kind)
    _save(_IDEAS_FILE, ideas)
    return ideas


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "idea").lower()).strip("-")
    return slug[:60] or "idea"


def export_idea_to_vault(vault_id: str, idea: dict) -> dict:
    """Write a single idea to the Obsidian vault as a markdown note."""
    title = idea.get("title", "Untitled idea")
    kind = idea.get("kind", "content")
    lines = [f"# {title}", "", f"- **Type:** {kind}", f"- **Captured:** {_now_iso()}", ""]
    for field in ("hook", "audience", "why_now", "format", "level", "outline"):
        if idea.get(field):
            lines.append(f"**{field.replace('_', ' ').title()}:** {idea[field]}")
            lines.append("")
    lines.append("\n#news-idea")
    content = "\n".join(lines)
    rel_path = f"News Ideas/{_slugify(title)}.md"
    return obsidian_vault_service.write_note(vault_id, rel_path, content)


def sources_status() -> dict:
    try:
        from firecrawl import FirecrawlApp  # type: ignore  # noqa: F401
        firecrawl_installed = True
    except ImportError:
        firecrawl_installed = False
    try:
        import praw  # type: ignore  # noqa: F401
        praw_installed = True
    except ImportError:
        praw_installed = False

    return {
        "x": {
            "available": firecrawl_installed,
            "configured": bool(os.getenv("FIRECRAWL_API_KEY")),
            "handle": config.NEWS_X_HANDLE,
        },
        "news": {
            "available": True,
            "configured": len(_load_feeds_config()) > 0,
            "feed_count": len(_load_feeds_config()),
        },
        "reddit": {
            "available": firecrawl_installed,
            "configured": bool(os.getenv("FIRECRAWL_API_KEY")),
            "subreddits": config.NEWS_SUBREDDITS,
        },
        "ideas": {
            "available": anthropic_client.has_api_key(),
            "configured": anthropic_client.has_api_key(),
            "model": config.NEWS_IDEA_MODEL,
        },
    }
