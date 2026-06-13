---
schedule: "30 8 * * *"
skill: ml-twitter-watch
inputs: ["today"]
---

# What this does

Each day at 08:30 (repo-local TZ), runs `ml-twitter-watch` to scrape the
curated set of ML X/Twitter handles via Firecrawl (free tier) and write a
themed digest of notable claims, links, and disagreements to
`vault/raw/daily/YYYY-MM-DD-ml-twitter.md`.

# Failure mode

Idempotent — re-running on the same day overwrites the day's digest.
Fail-soft per handle: a logged-out wall, challenge page, or 429 on one handle
is recorded under the digest's Notes section and the run continues. If
`FIRECRAWL_API_KEY` is unset the run writes a Notes-only digest and stops; it
never fabricates posts. Safe to retry on transient failures.
