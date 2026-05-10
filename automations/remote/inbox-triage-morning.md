---
schedule: "30 7 * * 1-5"
skill: inbox-triage
inputs: ["unread"]
---

# What this does

Each weekday at 07:30 (repo-local TZ), runs `inbox-triage` against
unread Gmail messages. Writes a labeled triage summary to
`vault/raw/daily/` and leaves the inbox itself unchanged.

# Failure mode

Idempotent — labels in Gmail are applied via the Gmail MCP and the
skill checks for existing labels before applying. Retrying within the
same day appends to the same daily note.
