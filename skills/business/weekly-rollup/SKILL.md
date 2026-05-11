---
name: weekly-rollup
description: Summarize the past week across Google Calendar events, vault daily notes, vault outputs, and GitHub activity, then write a structured weekly review. Use when asked for "weekly rollup", "weekly review", "recap this week", "week summary", "what happened this week", or "end of week review".
license: MIT
metadata:
  status: authored
  domain: business
  mode: remote
  mcp-server: google-calendar
  external-apis: []
  outputs: [vault/outputs/<YYYY-MM-DD>-weekly-rollup.md]
---

# Weekly Rollup

Aggregates the past week from calendar, vault, and GitHub into a single
structured review document. Designed to run on Friday afternoon or
Monday morning to close the previous week.

Uses the **multi-MCP coordination** pattern: calendar + vault reads +
optional GitHub — all pulled in before synthesis.

## References

- `references/services/calendar.md` — time-window queries, TZ gotchas
- `references/services/github.md` — `list_commits`, rate limits

## Instructions

### Step 1: Determine the week window

Default: Monday 00:00 through Sunday 23:59 of the most recently completed
week (in the user's local timezone).

If the user says "this week" and it is not yet Sunday, use Monday 00:00
through now.

Compute `week_label` = `YYYY-WW` (ISO week number, e.g. `2026-19`).

### Step 2: Pull calendar events for the week

Call `list_calendars` to get all calendar IDs. For each, call `list_events`
with the week's time window. Collect, deduplicate by `id`, filter cancelled
events. Group by day.

Extract:
- Total hours of meetings booked
- Unique external attendees met
- Recurring vs. one-off meetings
- Any meetings that were declined or cancelled

### Step 3: Read vault daily notes for the week

Scan `vault/raw/daily/` for files matching `YYYY-MM-DD-*.md` within the
week window. Read each. Extract:
- Tasks or decisions mentioned
- Outputs or artifacts produced (any files written)
- Notable events or blockers noted
- Skills run (look for "source:" fields in frontmatter)

### Step 4: Scan vault outputs for the week

List `vault/outputs/` and `vault/raw/daily/` for files created during the
week. Note their names — these are the tangible deliverables.

### Step 5: Pull GitHub activity (optional, if GITHUB_TOKEN is set)

If GitHub integration is available, call `list_commits` on the user's active
repositories for the week window. Summarize:
- Repos touched
- Commit count
- Notable commit messages (non-trivial)
- Any PRs opened or merged

If GitHub is not available, skip this step and note it in the output.

### Step 6: Synthesize and write

Write to `vault/outputs/YYYY-MM-DD-weekly-rollup.md`
(where the date is the Friday of the reviewed week):

```markdown
---
date: YYYY-MM-DD
week: YYYY-WW
domain: [business]
source: weekly-rollup
---

# Week YYYY-WW Rollup  (Mon DD Mon – Fri DD Mon YYYY)

## Summary
[2-3 sentence narrative: what was the dominant theme of the week?]

## Meetings & Collaboration
- **X hours** in meetings across Y events
- External: [unique external contacts met]
- Key discussions: [bullet list of notable meeting topics]

## Work Completed
[bullet list of tangible outputs: files written, decisions made, PRs merged]

## Vault Activity
- Daily notes created: X
- Wiki pages updated: Y
- Skills run: [list unique skill names from source: fields]

## GitHub Activity
[if available: repos touched, commit count, notable commits]
[if unavailable: "GitHub data not available — GITHUB_TOKEN not set"]

## Blockers & Carryovers
[anything unresolved, deferred, or blocked at week's end]

## Next Week
[optional: any scheduled items already on next week's calendar worth noting]
```

Report the output path to the user.

## Inputs

| Input | Description | Default |
|---|---|---|
| Week | Which week to review | Most recently completed week |
| Include GitHub | Pull commit history | Yes if GITHUB_TOKEN is set |

## Outputs

`vault/outputs/YYYY-MM-DD-weekly-rollup.md` where date is the Friday of
the reviewed week.

## Examples

**End of week:**
> "Weekly rollup"
→ Covers Mon–Sun of the just-completed week.

**In-progress week:**
> "Recap this week so far"
→ Covers Mon through today.

**Specific week:**
> "Rollup for week of May 5"
→ Anchors to the week containing May 5.

## Troubleshooting

**Calendar events missing:** Check that all calendar IDs from `list_calendars`
are queried. Personal and work calendars are often separate IDs.

**Vault notes not found:** The scanner looks for `YYYY-MM-DD-*.md` in
`vault/raw/daily/`. If daily notes use a different naming convention, adjust
the glob pattern.

**GitHub unavailable:** Add `GITHUB_TOKEN` to `.env.local`. For now, the
rollup still completes — GitHub section just notes the gap.
