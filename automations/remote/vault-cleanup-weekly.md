---
schedule: "0 9 * * 0"
skill: vault-cleanup
inputs: []
---

# What this does

Every Sunday at 09:00 (repo-local TZ), runs `vault-cleanup` to sweep
`vault/raw/` for stale notes, propose archives, and flag candidates for
promotion into `vault/wiki/`.

# Failure mode

Read-and-propose only — the skill writes a report to `vault/raw/daily/`
and never deletes. Safe to retry; duplicate reports get the same
filename and overwrite.
