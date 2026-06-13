# Tracked ML handles and keywords

Loaded on demand by `ml-twitter-watch`. Kept deliberately small: the
Firecrawl free tier is 10 req/min with a finite credit pool, and one scrape
is spent per handle. Add sparingly; prune handles that go quiet.

## Handles (one Firecrawl scrape each)

Default watch list (X handles, without the `@`):

- `karpathy`       — practical ML, training, tooling
- `ylecun`         — foundational ML, research direction
- `GoogleDeepMind` — lab announcements
- `OpenAI`         — lab announcements
- `AnthropicAI`    — lab announcements
- `_akhaliq`       — daily paper surfacing
- `srush_nlp`      — NLP/LLM research and pedagogy
- `giffmana`       — vision/scaling commentary

Cap a single run at 8 handles. To watch more, rotate the list by weekday
rather than scraping all of them every day.

## Keywords (for the optional /v1/search discovery pass)

`LLM`, `transformer`, `RLHF`, `diffusion`, `scaling laws`, `mechanistic
interpretability`, `mixture of experts`.

Use keywords only when a specific topic is requested; the default daily run
is handle-based to keep the request count predictable.

## Scope notes

- Profile URL form: `https://x.com/<handle>`. Nitter fallback:
  `https://nitter.net/<handle>` (often down — expected).
- This list is editorial, not exhaustive. It exists so the digest is
  reproducible and the request count is bounded, not to rank accounts.
