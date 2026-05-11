---
name: daily-rollup
description: Sweep the day's vault/raw/ notes, completed PRs, and calendar events into a single daily rollup with key items, decisions, and tomorrow's setup. Use at end-of-day or when the user asks for "daily rollup", "end-of-day", "wrap the day", "wrap up today".
license: MIT
metadata:
  status: authored
  domain: productivity
  mode: remote
  mcp-server: calendar+github
  external-apis: [none]
  outputs: [vault/raw/daily/YYYY-MM-DD-rollup.md]
---

# daily-rollup

Orchestration pattern: **multi-MCP coordination (fail-soft)**. Three
sources contribute (vault, Calendar, GitHub); if one fails the others
still produce a partial rollup. The final file always exists.

## References

- `references/services/calendar.md` — time-window queries, recurring
  event expansion, multiple-calendar gotchas.
- `references/services/github.md` — read-only scope on this repo, 403
  disambiguation, rate-limit headers.

## Instructions

1. Pin the date. Default to today in the user's local TZ. If the user
   passes a date, use that; if before ~02:00 local, ask whether they
   mean today or yesterday.
2. Pull the three sources **in parallel**. Each section below is
   independently fail-soft — a fetch error becomes a one-line note in
   the rollup, not a halt.
   - **Vault:** read every file modified today under `vault/raw/`
     (use `git log --since=midnight --name-only` then dedupe).
     Pull first H1 + first three bullet points from each.
   - **Calendar:** `list_events` against every calendar from
     `list_calendars`, today's window in user TZ. De-dupe by
     `recurringEventId`; drop `status: "cancelled"`; flag attendee
     count ≥5 as "meeting" vs <5 as "1:1 / small".
   - **GitHub:** `list_commits` on the user's branches today, plus
     `pull_request_read` for any PRs touched today. Read-only scope.
3. Compose the rollup. Sections in fixed order:
   ```
   # YYYY-MM-DD daily rollup

   ## Did today
   ## Decisions
   ## Open threads
   ## Tomorrow
   ```
   Pull "Decisions" from vault note headers matching `## Decision` or
   `**Decided:**`. Pull "Open threads" from any vault note that has an
   open checkbox `- [ ]` written today.
4. Write to `vault/raw/daily/YYYY-MM-DD-rollup.md`. If the file
   already exists, append a `## Re-run HH:MM` section rather than
   overwrite — the prior rollup may already be the user's reference.

## Inputs

- `date` (optional, ISO 8601). Default: today in user TZ.
- `calendars` (optional, list of calendar IDs). Default: every
  calendar returned by `list_calendars`.

## Outputs

- `vault/raw/daily/<YYYY-MM-DD>-rollup.md`

## Examples

User: "wrap up today"

→ Skill loads today's vault writes (4 files), today's events from
primary + work calendars (3 events, 1 cancelled, drops to 2), today's
commits on `main` and one feature branch (5 commits). Writes
`vault/raw/daily/2026-05-10-rollup.md`:

```md
# 2026-05-10 daily rollup

## Did today
- Shipped phase 4 (PR #5)
- Started Anxious Nomad newsletter draft
- ...

## Decisions
- Use cron-parser v5 over custom regex (PR #5)

## Open threads
- [ ] Test newsletter draft against last 3 issues

## Tomorrow
- 09:00 Standup
- 14:00 Eng review
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Rollup says "Calendar fetch failed" | Token expired or MCP server down | Re-auth Calendar MCP; rollup still has vault + GH sections |
| All-day events missing | Skill checking `start.dateTime` only | Calendar returns all-day with `start.date` — see `references/services/calendar.md` |
| Same meeting listed N times | Recurring event not de-duped | De-dupe by `recurringEventId` before formatting |
| "GH commits" empty on a busy day | Read-only scope on a non-allowlisted repo | Skill only sees `tirtheshjani/agentic-os`; other repos invisible — note this in rollup |
