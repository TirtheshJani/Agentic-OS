# arXiv API — service reference

Used by skills that pull paper listings or metadata. arXiv has an open
HTTP API; no auth required. The endpoint is
`http://export.arxiv.org/api/query`.

## Auth

None. Public.

## Rate limits

- **Documented courtesy limit:** ≥3 seconds between requests from the
  same client. arXiv asks (rather than enforces), but burst behavior
  earns 503s quickly.
- **No per-day quota** documented, but bulk pulls of >1000 entries in
  a single session will get throttled.

If a skill fans out across N categories, **stagger the calls 3s
apart**, don't parallelize.

## Endpoint and query shape

Base: `http://export.arxiv.org/api/query`

Parameters:
- `search_query` — the actual query (see below).
- `start` — pagination offset (default 0).
- `max_results` — page size (default 10, max 2000; 50–100 is sane).
- `sortBy` — `relevance` | `lastUpdatedDate` | `submittedDate`.
- `sortOrder` — `ascending` | `descending`.

Common query patterns:

| Goal | `search_query` |
|---|---|
| Recent in a category | `cat:cs.LG` (combine with `sortBy=submittedDate&sortOrder=descending`) |
| Date window | `cat:cs.LG AND submittedDate:[202605100000 TO 202605102359]` |
| Author | `au:lecun_y` (last_first format) |
| Title keyword | `ti:diffusion` |
| Multi-category OR | `cat:cs.LG OR cat:stat.ML` |

Date format in `submittedDate` is `YYYYMMDDhhmm` (UTC), no separators.

## Response format

Atom 1.0 XML. Top-level `<feed>` with metadata + N `<entry>`
elements. Per-entry fields you'll actually use:

| XPath | Notes |
|---|---|
| `atom:id` | URL form; canonical ID is the path tail. Strip `vN` for cross-version dedupe. |
| `atom:title` | Often has line breaks and double spaces; collapse whitespace before display. |
| `atom:summary` | The abstract. Same whitespace cleanup. |
| `atom:author/atom:name` | One per author. |
| `atom:published` | First-version submission, UTC. |
| `atom:updated` | Most recent version, UTC. |
| `arxiv:primary_category` | The actual primary, in case you queried by a cross-list. |
| `arxiv:comment` | Author-supplied notes ("8 pages, 3 figures"). Useful for filtering. |
| `link[@rel='alternate']` | abs URL. |
| `link[@title='pdf']` | PDF URL. |

The `arxiv:` namespace is `http://arxiv.org/schemas/atom`; declare it
explicitly when parsing.

## Common errors

| Symptom | Likely cause | Action |
|---|---|---|
| HTTP 503 | Rate-limited or service overload | Backoff 15s, retry once. If still 503, write partial output and note the gap. |
| Empty `<feed>` (no entries) | Date filter too narrow, or before ~09:00 UTC for "today" queries | Fall back to previous UTC day. |
| Malformed XML | Transient issue or middlebox interference | Retry; if persistent, the wrong endpoint is being hit (HTTP vs HTTPS sometimes differs). |
| Same paper appears twice | Cross-listed across categories | Dedupe by canonical id (everything before `vN`). |
| Missing fields on some entries | Incomplete submission (rare) | Skip silently; don't fail the whole digest. |

## Gotchas

- **UTC-only timestamps.** "Today" depends on what timezone the user
  cares about. Filter in UTC, display in local.
- **`v1` vs `v2` IDs.** `2401.12345v1` and `2401.12345v2` are the same
  paper. Strip the version when deduping or comparing.
- **Cross-listed papers.** A paper in `cs.LG` may also list `stat.ML`
  as a secondary. Querying both categories returns the entry twice;
  dedupe by canonical id.
- **`primary_category` ≠ first category in the entry.** Use the
  `arxiv:primary_category` element, not the first `category` link.
- **Abstracts are markdown-unfriendly.** They contain LaTeX (`$...$`,
  `\\textit{}`). For digest summaries, either preserve the LaTeX
  verbatim or strip it; don't try to render it.

## See also

- Authoritative docs: <https://info.arxiv.org/help/api/user-manual.html>
- Validator script: `scripts/validators/validate_arxiv_atom.py`
- Default categories for this repo:
  `skills/research/physics-ml/arxiv-daily-digest/references/arxiv-categories.md`
