---
name: ml-twitter-watch
description: Pull recent ML-related discussions from a curated set of X/Twitter accounts and write a digest of notable claims, links, and disagreements to vault/raw/daily/YYYY-MM-DD-ml-twitter.md. Best-effort fail-soft over a list of handles. Use when the user asks for "ML twitter today", "what's the discourse on X", "twitter recap", "ML twitter digest".
license: MIT
metadata:
  status: blocked
  domain: research/physics-ml
  mode: remote
  mcp-server: none
  external-apis: [firecrawl, nitter]
  outputs: [vault/raw/daily/YYYY-MM-DD-ml-twitter.md]
---

# ml-twitter-watch

Orchestration pattern: **multi-MCP coordination** (fan-out over N handles
via 1–2 independent transports, each fail-soft, single merged digest).

**Implementation note:** this body describes the intended flow once a
reliable Twitter/X transport is configured. No first-party Twitter/X API
key is wired into this repo today, and unauthenticated scraping of x.com
is actively antagonised by the platform. Status stays `blocked` until a
transport is reliably available (paid X API, Apify actor, or a
self-hosted Nitter instance). The skill is structured to **fail soft**:
if every handle fails, the digest is still written with a Notes section
listing what failed and why.

## References

- `references/handles.md` — curated default watchlist (~10 accounts) and
  rationale per handle.
- `../../article-extractor/SKILL.md` — Firecrawl/trafilatura/reader
  detection pattern this skill mirrors for the per-handle fetch step.
- `../../general/morning-trend-scan/SKILL.md` — same fail-soft fan-out
  shape (independent sources, single digest, Notes section).

## Transports (ordered by preference)

Pick the first one that is configured. Do not silently skip — record
which transport ran in the digest header.

1. **Official X API v2** (`X_BEARER_TOKEN` env var). Use
   `GET /2/users/by/username/:handle` to resolve the ID, then
   `GET /2/users/:id/tweets?max_results=20&exclude=retweets,replies`.
   Rate limit: 1500 tweets / 15 min on the free tier. This is the only
   transport that is contractually allowed; everything below is best
   effort.
2. **Firecrawl** against `https://x.com/<handle>`. Returns rendered
   HTML for the profile page. Often returns the login interstitial
   instead of tweets — treat empty results as a failure for that
   handle, not as "no tweets".
3. **Nitter mirror** (e.g. `nitter.net`, `nitter.privacydev.net`,
   `nitter.poast.org`). Fetch `https://<mirror>/<handle>/with_replies`
   with curl. Mirrors are blocked, rate-limited, and disappear
   constantly. Rotate through a list; treat a 5xx or HTML error page
   as a per-mirror failure.

If none are configured or all fail for a given handle, that handle is
listed under Notes and skipped.

## Instructions

1. **Pin the date and window.** `now = today in user TZ`,
   `since = now - lookback_hours`. Default `lookback_hours = 24`.
2. **Load the watchlist.** Read `references/handles.md` and parse the
   handles column. If the caller passed `handles`, use that list
   verbatim instead and skip the parse.
3. **Detect the transport** (see *Transports* above). Record the chosen
   transport name for the header.
4. **Fan out, fail soft.** For each handle, try to fetch up to N=20
   recent posts within the window:
   - **X API path:** standard request, parse JSON, keep `id`, `text`,
     `created_at`, `public_metrics.like_count`, any `entities.urls`.
   - **Firecrawl path:** call Firecrawl with `formats: ["markdown"]`
     against `https://x.com/<handle>`. If the markdown is shorter than
     ~400 chars or contains the string "Log in" / "Sign up" in the
     first 200 chars, count it as failed.
   - **Nitter path:** curl the mirror, parse `.timeline-item` blocks
     (one tweet each). 4xx/5xx → failed. Empty timeline → failed.
   On any per-handle failure, append the handle and a one-line reason
   to a `failures` list and continue.
5. **Filter to ML-relevant posts.** Drop posts that look unrelated to
   ML/AI research (heuristic: keep if any of `model`, `paper`,
   `arxiv`, `train`, `eval`, `tokens`, `attention`, `agent`, `RL`,
   `scaling`, `benchmark`, `LLM`, `diffusion`, `gradient` appear
   case-insensitive, OR the post links to arxiv.org / github.com /
   a known ML lab domain). The bar is low — false positives are
   cheaper than false negatives here.
6. **Cluster into themes.** Group remaining posts by shared URLs
   (same arxiv ID, same repo) and by simple keyword overlap (Jaccard
   on lowercased tokens ≥ 0.3). Each cluster becomes one bullet under
   "Notable claims & threads"; standalone posts become their own
   bullet.
7. **Spot disagreements.** Within a cluster, if two posts contain
   opposing markers (`disagree`, `wrong`, `actually`, `no,`,
   `pushback`, quote-tweets across handles), surface them as a
   sub-bullet `— disagreement: @a vs @b`.
8. **Compose the digest.** Sections in this order:
   ```
   # YYYY-MM-DD ML twitter watch

   _Transport: <name> · Window: last <H>h · Handles: <ok>/<total>_

   ## Notable claims & threads
   ## Links shared (arxiv / github / blogs)
   ## Disagreements
   ## Notes
   ```
   - Each thread bullet: `@handle — 1-sentence summary [link](url)`.
   - Links section: deduped list of all `arxiv.org/abs/...` and
     `github.com/<org>/<repo>` URLs, with the count of handles that
     shared each.
   - Notes section: every failed handle with its reason; the chosen
     transport; any rate-limit waits.
9. **Write** to `vault/raw/daily/<YYYY-MM-DD>-ml-twitter.md`.
   Idempotent — re-running the same day overwrites.
10. **If zero handles succeeded,** still write the file. Body is just
    the header plus a Notes section explaining the failure. This is
    intentional so the dashboard and `vault-cleanup` see a stable
    artifact and the failure is visible.

## Inputs

- `handles` (optional, list of strings). Default: parsed from
  `references/handles.md`. Strings may include or omit the leading `@`.
- `lookback_hours` (optional, int). Default: `24`. Posts older than
  `now - lookback_hours` are dropped.
- `max_per_handle` (optional, int). Default: `20`. Upper bound on
  posts fetched per handle before window filtering.

## Outputs

- `vault/raw/daily/<YYYY-MM-DD>-ml-twitter.md`

## Examples

User: "ML twitter recap"

→ Today: X API configured. 10 handles in watchlist. 8 succeed, 2 fail
(one rate-limited, one renamed account). 47 posts fetched, 23 pass the
ML filter, cluster into 9 threads. 2 disagreements detected. Digest
written:

```md
# 2026-05-15 ML twitter watch

_Transport: x-api · Window: last 24h · Handles: 8/10_

## Notable claims & threads
- @karpathy — "tokenization is half the bug surface of any LLM"; recommends BPE inspection script [thread](https://x.com/karpathy/status/...)
- @_jasonwei — new paper on inference-time scaling, ~3x cheaper at fixed quality [arxiv](https://arxiv.org/abs/2605.01234)
- ...

## Links shared (arxiv / github / blogs)
- https://arxiv.org/abs/2605.01234 — shared by @_jasonwei, @hardmaru (2)
- https://github.com/foo/bar — shared by @soumithchintala (1)

## Disagreements
- Scaling-laws thread — disagreement: @ylecun vs @hwchung27 on whether the new fit holds below 100M params.

## Notes
- Transport: x-api (bearer token from $X_BEARER_TOKEN).
- Failed: @demishassabis (no posts in window), @sama (HTTP 429, retry budget exhausted).
```

User: "ML twitter today" (transport unavailable)

→ All three transports fail / unconfigured. File still written:

```md
# 2026-05-15 ML twitter watch

_Transport: none · Window: last 24h · Handles: 0/10_

## Notes
- No transport configured. Set X_BEARER_TOKEN, or configure Firecrawl, or specify a working Nitter mirror.
- Skill is currently metadata.status: blocked pending a reliable transport.
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Firecrawl returns ~200 chars of "Log in to X" | x.com served the auth wall | Mark handle failed; try X API or Nitter instead |
| Every Nitter mirror returns 5xx | Mirrors blocked or down | Try X API / Firecrawl; record in Notes |
| X API 429 | Free-tier rate limit hit | Sleep until `x-rate-limit-reset`, retry once, then mark remaining handles failed |
| Digest has no "Notable claims" but Notes is full | All handles failed the ML filter | Lower the heuristic bar or widen `lookback_hours` |
| Same post appears under two clusters | Cross-linked URLs in shared bullets | De-dupe clusters by smallest post-id set before formatting |
| Handle returns 404 | Account renamed/suspended | Update `references/handles.md`; mark failed for this run |
| File written but body is just Notes | Zero handles succeeded | Expected fail-soft behavior; check Notes for transport status |
