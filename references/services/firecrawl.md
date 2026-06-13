# Firecrawl

Firecrawl turns a URL into clean markdown (JS rendered server-side), and
runs web searches. It is the free-tier path for fetching content that has no
public API — including public X/Twitter profile pages. No MCP server; skills
call the HTTP endpoints directly. The skill-local
`skills/research/general/deep-web-research/references/firecrawl-tips.md` holds
selector/pagination tips; this file is the shared service contract.

## Endpoints

```
POST https://api.firecrawl.dev/v1/scrape    { "url": "...", "formats": ["markdown"] }
POST https://api.firecrawl.dev/v1/search    { "query": "...", "limit": 10 }
```

`/v1/scrape` returns `{ success, data: { markdown, metadata } }`.
`/v1/search` returns `{ success, data: [ { url, title, description } ] }`.

## Auth scopes

Bearer token in the `Authorization` header, read from the `FIRECRAWL_API_KEY`
environment variable. There are no per-scope tokens — one key, full access.

```
Authorization: Bearer ${FIRECRAWL_API_KEY}
```

If `FIRECRAWL_API_KEY` is unset, the skill cannot run: fail soft (write a
Notes entry, skip the block), never invent content.

## Rate limits

- **Free tier: 10 requests per minute.** Hobby tier: 100 req/min.
- The free tier also has a finite monthly credit pool (one credit per
  scrape). Scope each run to a small URL list and a daily cadence.
- On HTTP 429, honor the `Retry-After` header; sequentialize calls rather
  than firing them in parallel. There are no other rate-limit headers.

## Tool selection

- **A known page (a profile, an article)** → `/v1/scrape` with that URL.
- **Discovery ("recent posts about X")** → `/v1/search`, then `/v1/scrape`
  the top results. Costs one call per scrape, so cap the fan-out.
- For **X/Twitter**, scrape the public profile URL
  (`https://x.com/<handle>`); Firecrawl renders the JS timeline. Public
  Nitter mirrors (`https://nitter.net/<handle>`) are a fallback but are
  frequently down — treat a Nitter failure as expected, not an error.

## Common gotchas

- **Login walls.** `x.com` sometimes serves a logged-out wall with only a
  few tweets. That is the free-tier ceiling — take what renders, do not try
  to authenticate.
- **JS-rendered SPAs** need `pageOptions: { waitFor: 2000 }`; an empty
  `markdown` usually means the page had not hydrated yet. Re-scrape once.
- **Challenge pages** (Cloudflare/CAPTCHA) return HTTP 200 with a challenge
  body. Detect by string match on `cf-challenge` or `Just a moment...` and
  treat as a fetch failure for that URL.
- **`success: false`** in the JSON body is the real failure signal, not just
  the HTTP status. Always branch on it.
- **Stale content.** Scrapes reflect what rendered at fetch time; there is no
  freshness guarantee. De-dupe items across runs by a stable key (post URL).
