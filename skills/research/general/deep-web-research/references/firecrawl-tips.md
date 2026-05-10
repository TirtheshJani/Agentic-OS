# Firecrawl tips

Reference for the deep-web-research skill. Loaded on demand per
progressive disclosure.

## Rate limits
- Default: 10 req/min on the free tier; 100 req/min on the Hobby tier.
- Back off on 429 with Retry-After header.

## Selectors that usually work
- `main, article, [role="main"]` — primary content on most blogs.
- `h1, h2, h3` for outlines.
- Drop `nav, aside, footer, .ads, .sidebar` reliably.

## Pagination
- Detect `rel="next"` first; fall back to URL pattern (`?page=N`).
- Cap at 10 pages by default; widen only on explicit instruction.

## Pitfalls
- JS-rendered SPAs need the `pageOptions: { waitFor: 2000 }` flag.
- Cloudflare/CAPTCHA pages return 200 with a challenge body — detect by
  string match on `cf-challenge` or `Just a moment...`.
