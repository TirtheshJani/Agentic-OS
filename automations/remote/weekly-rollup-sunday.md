---
schedule: "0 18 * * 0"
skill: weekly-rollup
inputs: {}
---

# What this does

Every Sunday at 18:00 UTC, runs the `weekly-rollup` skill against the
current ISO week (`week_offset=0`). The skill chains the previous 7
days of upstream daily outputs (`morning-trend-scan`, `daily-rollup`,
`inbox-triage`) from `vault/raw/daily/` into a single wiki page at
`vault/wiki/business/weekly-YYYY-Www.md`.

# Failure mode

If one or more of the 21 expected daily files (7 days × 3 upstream
skills) is missing, the run **does not fail**. The skill records the
gap in the digest's `## Coverage` section and proceeds with whatever
data is available — partial coverage is better than no rollup.

If **all** 21 daily files are missing (the chain never ran), the
skill aborts with a clear message and does **not** write an empty
wiki page. Re-trigger manually after backfilling at least one day of
upstream output.

The skill is idempotent on the week file: re-running for the same ISO
week overwrites the existing wiki page with the freshest aggregation.
Safe to retry on transient failures.
