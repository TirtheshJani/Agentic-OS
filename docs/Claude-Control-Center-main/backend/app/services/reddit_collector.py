from __future__ import annotations

"""Reddit data collection — hot posts via public RSS, search via PRAW (optional)."""

import logging
import os
import re

try:
    from defusedxml import ElementTree as ET  # type: ignore
    from defusedxml.ElementTree import ParseError as _XMLParseError  # type: ignore
except ImportError:
    from xml.etree import ElementTree as ET  # type: ignore
    from xml.etree.ElementTree import ParseError as _XMLParseError  # type: ignore

import httpx

logger = logging.getLogger(__name__)

_ATOM_NS = "{http://www.w3.org/2005/Atom}"
_MEDIA_NS = "{http://search.yahoo.com/mrss/}"
_HEADERS = {"User-Agent": "ccc-news/1.0"}

try:
    import praw  # type: ignore
    _PRAW_AVAILABLE = True
except ImportError:
    _PRAW_AVAILABLE = False


def _get_praw_client():
    if not _PRAW_AVAILABLE:
        raise RuntimeError("praw is not installed. Run: pip install praw")
    client_id = os.getenv("REDDIT_CLIENT_ID", "")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET", "")
    user_agent = os.getenv("REDDIT_USER_AGENT", "ccc-research/1.0")
    if not client_id or not client_secret:
        raise RuntimeError(
            "Reddit not configured. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET env vars."
        )
    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
        read_only=True,
    )


def _parse_atom_entry(entry) -> dict:
    def _t(tag: str) -> str:
        el = entry.find(f"{_ATOM_NS}{tag}")
        return (el.text or "").strip() if el is not None and el.text else ""

    title = _t("title")
    link_el = entry.find(f"{_ATOM_NS}link[@rel='alternate']")
    if link_el is None:
        link_el = entry.find(f"{_ATOM_NS}link")
    url = link_el.get("href", "") if link_el is not None else ""
    content = _t("content") or _t("summary")
    content = re.sub(r"<[^>]+>", "", content).strip()
    author_el = entry.find(f"{_ATOM_NS}author/{_ATOM_NS}name")
    author = (author_el.text or "").strip() if author_el is not None and author_el.text else ""
    updated = _t("updated")
    # Extract subreddit from the URL
    m = re.search(r"/r/([^/]+)/", url)
    subreddit = m.group(1) if m else ""

    return {
        "id": _t("id"),
        "title": title,
        "url": url,
        "permalink": url,
        "score": None,
        "num_comments": None,
        "created_utc": 0,
        "selftext": content[:2000],
        "author": author,
        "subreddit": subreddit,
        "timestamp": updated,
    }


def hot_posts(subreddits: list[str], limit: int = 5) -> list[dict]:
    """Fetch top hot posts via Reddit's public Atom RSS feed — no credentials required."""
    results: list[dict] = []
    for subreddit in subreddits:
        url = f"https://www.reddit.com/r/{subreddit}/hot.rss?limit={limit}"
        try:
            resp = httpx.get(url, headers=_HEADERS, timeout=15.0, follow_redirects=True)
            if resp.status_code >= 400:
                logger.warning("reddit_collector: r/%s RSS returned %s", subreddit, resp.status_code)
                continue
            root = ET.fromstring(resp.content)
            entries = root.findall(f"{_ATOM_NS}entry")
            for entry in entries[:limit]:
                post = _parse_atom_entry(entry)
                if post["title"]:
                    results.append(post)
        except _XMLParseError as exc:
            logger.warning("reddit_collector: XML parse failed for r/%s: %s", subreddit, exc)
        except Exception as exc:
            logger.warning("reddit_collector: hot_posts failed for r/%s: %s", subreddit, exc)
    return results


def search_subreddit(
    subreddit: str,
    query: str,
    limit: int = 25,
    sort: str = "relevance",
) -> list[dict]:
    """Search a specific subreddit."""
    client = _get_praw_client()
    results = []
    try:
        sub = client.subreddit(subreddit)
        for post in sub.search(query, sort=sort, limit=limit):
            results.append({
                "id": post.id,
                "title": post.title,
                "url": post.url,
                "score": post.score,
                "num_comments": post.num_comments,
                "created_utc": post.created_utc,
                "selftext": (post.selftext or "")[:2000],
                "author": str(post.author) if post.author else "",
                "permalink": f"https://reddit.com{post.permalink}",
            })
    except Exception as exc:
        logger.warning("reddit_collector: search_subreddit failed for r/%s: %s", subreddit, exc)
    return results


def get_post(post_url: str) -> dict:
    """Fetch full post + top comments."""
    client = _get_praw_client()
    submission = client.submission(url=post_url)
    submission.comments.replace_more(limit=0)
    comments = []
    for c in list(submission.comments)[:20]:
        comments.append({
            "author": str(c.author) if c.author else "",
            "body": (c.body or "")[:1000],
            "score": c.score,
        })
    return {
        "id": submission.id,
        "title": submission.title,
        "selftext": (submission.selftext or "")[:5000],
        "url": submission.url,
        "score": submission.score,
        "num_comments": submission.num_comments,
        "created_utc": submission.created_utc,
        "author": str(submission.author) if submission.author else "",
        "permalink": f"https://reddit.com{submission.permalink}",
        "comments": comments,
    }


def hot_posts(
    subreddits: list[str],
    limit: int = 10,
) -> list[dict]:
    """Fetch hot posts across several subreddits (no search query). Dedupes by id."""
    client = _get_client()
    seen: set[str] = set()
    results: list[dict] = []

    for sub_name in subreddits:
        try:
            sub = client.subreddit(sub_name)
            for post in sub.hot(limit=limit):
                if post.stickied or post.id in seen:
                    continue
                seen.add(post.id)
                results.append({
                    "id": post.id,
                    "title": post.title,
                    "url": post.url,
                    "score": post.score,
                    "num_comments": post.num_comments,
                    "created_utc": post.created_utc,
                    "selftext": (post.selftext or "")[:2000],
                    "author": str(post.author) if post.author else "",
                    "permalink": f"https://reddit.com{post.permalink}",
                    "subreddit": post.subreddit.display_name,
                })
        except Exception as exc:
            logger.warning("reddit_collector: hot_posts failed for r/%s: %s", sub_name, exc)

    return results


def search_reddit(
    query: str,
    subreddits: list[str] | None = None,
    limit: int = 25,
) -> list[dict]:
    """Search multiple subreddits or r/all. Deduplicates by post id."""
    client = _get_praw_client()
    seen: set[str] = set()
    results: list[dict] = []

    target_subs = subreddits or ["all"]

    for sub_name in target_subs:
        try:
            sub = client.subreddit(sub_name)
            for post in sub.search(query, sort="relevance", limit=limit):
                if post.id in seen:
                    continue
                seen.add(post.id)
                results.append({
                    "id": post.id,
                    "title": post.title,
                    "url": post.url,
                    "score": post.score,
                    "num_comments": post.num_comments,
                    "created_utc": post.created_utc,
                    "selftext": (post.selftext or "")[:2000],
                    "author": str(post.author) if post.author else "",
                    "permalink": f"https://reddit.com{post.permalink}",
                    "subreddit": post.subreddit.display_name,
                })
        except Exception as exc:
            logger.warning("reddit_collector: search failed for r/%s: %s", sub_name, exc)

    return results
