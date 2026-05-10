---
schedule: "0 9 * * 1-5"
skill: morning-trend-scan
inputs: ["today"]
---

# What this does

Each weekday at 09:00 (repo-local TZ), runs `morning-trend-scan` to scan
GitHub trending repos plus the day's arXiv submissions and writes a
brief digest to `vault/raw/daily/`.

# Failure mode

Idempotent — re-running on the same day overwrites the day's digest with
the same content modulo any new submissions in the interim. Safe to retry
on transient failures.
