---
schedule: "0 18 * * 1-5"
skill: daily-rollup
inputs: []
---

# What this does

Each weekday at 18:00 (repo-local TZ), runs `daily-rollup` to consolidate
the day's `vault/raw/daily/` notes plus any new `wiki/` writes into a
single end-of-day summary in `vault/raw/daily/YYYY-MM-DD.md`.

# Failure mode

Idempotent — re-running on the same day overwrites that day's rollup
section. Safe to retry on transient failures.
