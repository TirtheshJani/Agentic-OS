---
name: ml-twitter-watch
description: Pull recent ML discussion from a curated set of X/Twitter handles via Firecrawl (free tier, no premium X API) and write a digest of notable claims, links, and disagreements to vault/raw/daily/. Use when the user asks for "ML twitter today", "what's the discourse on X", "twitter recap", "ml twitter watch".
license: MIT
metadata:
  status: authored
  domain: research/physics-ml
  mode: remote
  mcp-server: none
  external-apis: [firecrawl]
  outputs: [vault/raw/daily/YYYY-MM-DD-ml-twitter.md]
---

# ml-twitter-watch

Orchestration pattern: **sequential workflow, fail-soft per source**. Each
handle is scraped independently through Firecrawl; one failure never sinks
the run. No premium X API: Firecrawl's free tier renders public profile
pages, per @ruwzeta on issue #38.

## References

- `references/services/firecrawl.md` — endpoints, `FIRECRAWL_API_KEY` auth,
  free-tier 10 req/min limit, 429 handling, X/Twitter scraping notes.
- `skills/research/general/deep-web-research/references/firecrawl-tips.md` —
  selectors, `waitFor` for JS-rendered pages, challenge-page detection.
- `references/handles.md` (skill-local) — the curated watch list and the
  per-run 8-handle cap that keeps the request count bounded.

## Instructions

1. **Preflight.** Confirm `FIRECRAWL_API_KEY` is set. If not, write a digest
   with only a Notes line ("FIRECRAWL_API_KEY unset; no fetch") and stop —
   never fabricate tweets. Pin the date (today in user TZ).
2. **Load the watch list** from `references/handles.md`. Cap at 8 handles per
   run. Honor the free-tier limit: scrape **sequentially** with a short pause
   so the run stays under 10 req/min; never parallelize the fan-out.
3. **Scrape each handle.** `POST https://api.firecrawl.dev/v1/scrape` with
   `{ "url": "https://x.com/<handle>", "formats": ["markdown"] }` and the
   bearer header. Branch on `success` in the body, not just HTTP status.
   - Empty markdown (unhydrated SPA) → re-scrape once with
     `pageOptions: { waitFor: 2000 }`.
   - `cf-challenge` / `Just a moment...` body, or a logged-out wall → record
     the handle under Notes and move on (this is the free-tier ceiling).
   - 429 → honor `Retry-After`, then continue sequentially.
4. **Extract posts.** From each profile's markdown, take the most recent
   posts (cap ~5 per handle). For each, capture the text, any outbound link,
   and the permalink. De-dupe across handles by permalink (retweets/quotes).
5. **Synthesize, do not just list.** Group the day's posts into a few themes;
   call out notable claims, shared links (papers, repos, releases), and any
   visible disagreement between accounts. Attribute every claim to its handle
   and permalink — no unsourced assertions.
6. **Compose the digest.** Sections in this order:
   ```
   # YYYY-MM-DD ML twitter watch

   ## Themes
   ## Notable links
   ## Disagreements / open threads
   ## Notes
   ```
   Post refs: `@handle — claim ([link](permalink))`.
7. **Write** to `vault/raw/daily/<YYYY-MM-DD>-ml-twitter.md`. Idempotent:
   re-running on the same day overwrites the file.

## Inputs

- `handles` (optional, list). Default: the list in `references/handles.md`.
- `max_handles` (optional, int). Default: 8 (free-tier request budget).
- `posts_per_handle` (optional, int). Default: 5.
- `keywords` (optional, list). When present, run one `/v1/search` discovery
  pass (see `references/handles.md`) in addition to the handle scrapes.

## Outputs

- `vault/raw/daily/<YYYY-MM-DD>-ml-twitter.md`

## Examples

User: "ml twitter today"

→ 8 handles scraped sequentially; 2 hit a logged-out wall (noted). 31 posts
extracted, de-duped to 24. Clustered into three themes; two papers and one
repo surfaced; one disagreement flagged. Digest written:

```md
# 2026-06-13 ML twitter watch

## Themes
- **Long-context eval**: @srush_nlp and @giffmana debate whether needle-in-
  -haystack saturates ([link](https://x.com/srush_nlp/status/...)).

## Notable links
- [paper: ...](https://arxiv.org/abs/...) — shared by @_akhaliq

## Disagreements / open threads
- MoE routing stability: @karpathy skeptical, @giffmana counters ([link](...)).

## Notes
- @OpenAI, @AnthropicAI: logged-out wall, only pinned post visible.
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| All handles return a logged-out wall | X tightened the public view | Take what renders; note it; consider the Nitter fallback per the service ref |
| Firecrawl 429 early | Free-tier 10 req/min tripped | Honor `Retry-After`; scrape sequentially, never parallel |
| Empty markdown for a handle | JS not hydrated | Re-scrape once with `pageOptions: { waitFor: 2000 }` |
| `success: false` in body, HTTP 200 | Firecrawl-side fetch failure | Treat as a failed handle; record under Notes |
| Same post under two handles | Retweet / quote | De-dupe by permalink before theming |
| `FIRECRAWL_API_KEY` unset | Secret not provisioned | Write the Notes-only digest and stop; do not fabricate |
