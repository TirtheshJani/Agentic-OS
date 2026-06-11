from __future__ import annotations

"""Web scraping via Firecrawl Python SDK."""

import logging
import os

logger = logging.getLogger(__name__)

try:
    from firecrawl import FirecrawlApp  # type: ignore
    _FIRECRAWL_AVAILABLE = True
except ImportError:
    _FIRECRAWL_AVAILABLE = False


def _get_client():
    api_key = os.getenv("FIRECRAWL_API_KEY", "")
    if not api_key or not _FIRECRAWL_AVAILABLE:
        if not _FIRECRAWL_AVAILABLE:
            raise RuntimeError("firecrawl-py is not installed. Run: pip install firecrawl-py")
        raise RuntimeError("Firecrawl not configured (FIRECRAWL_API_KEY missing)")
    return FirecrawlApp(api_key=api_key)


def scrape_url(url: str) -> dict:
    """Scrape a URL and return markdown content."""
    client = _get_client()
    try:
        result = client.scrape_url(url, params={"formats": ["markdown"]})
        if isinstance(result, dict):
            return {
                "url": url,
                "title": result.get("metadata", {}).get("title", ""),
                "content": result.get("markdown", result.get("content", "")),
                "description": result.get("metadata", {}).get("description", ""),
            }
        # Handle object response
        metadata = getattr(result, "metadata", {}) or {}
        return {
            "url": url,
            "title": metadata.get("title", "") if isinstance(metadata, dict) else "",
            "content": getattr(result, "markdown", "") or getattr(result, "content", "") or "",
            "description": metadata.get("description", "") if isinstance(metadata, dict) else "",
        }
    except Exception as exc:
        logger.warning("firecrawl_collector: scrape_url failed for %s: %s", url, exc)
        return {"url": url, "title": "", "content": "", "description": ""}


def search_web(query: str, limit: int = 10) -> list[dict]:
    """Use Firecrawl search endpoint."""
    client = _get_client()
    results: list[dict] = []
    try:
        response = client.search(query, params={"limit": limit})
        items = []
        if isinstance(response, dict):
            items = response.get("data", response.get("results", []))
        elif isinstance(response, list):
            items = response
        elif hasattr(response, "data"):
            items = response.data or []

        for item in items:
            if isinstance(item, dict):
                results.append({
                    "url": item.get("url", ""),
                    "title": item.get("title", "") or item.get("metadata", {}).get("title", ""),
                    "content": item.get("markdown", item.get("content", "")),
                    "description": item.get("description", "") or item.get("metadata", {}).get("description", ""),
                })
            else:
                metadata = getattr(item, "metadata", {}) or {}
                results.append({
                    "url": getattr(item, "url", ""),
                    "title": metadata.get("title", "") if isinstance(metadata, dict) else "",
                    "content": getattr(item, "markdown", "") or getattr(item, "content", "") or "",
                    "description": metadata.get("description", "") if isinstance(metadata, dict) else "",
                })
    except Exception as exc:
        logger.warning("firecrawl_collector: search_web failed for '%s': %s", query, exc)
    return results
