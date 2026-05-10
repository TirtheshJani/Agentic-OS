---
name: daily-rollup
description: Sweep the day's vault/raw/ notes, calendar events, and GitHub activity into a single end-of-day rollup with key items, decisions, and tomorrow's setup. Use at end-of-day or when the user asks for "daily rollup", "end-of-day", "wrap the day", "what did I do today".
license: MIT
metadata:
  status: authored
  domain: productivity
  mode: remote
  mcp-server: calendar
  external-apis: [none]
  outputs: [vault/raw/daily/YYYY-MM-DD-rollup.md]
---

# daily-rollup

End-of-day synthesis. Pulls signal from three sources (vault notes,
calendar, GitHub) and writes a single rollup that the user can read in
two minutes and resume tomorrow without re-orienting.

**Orchestration pattern:** multi-MCP coordination — the three sources
are gathered in parallel, then merged. Fail-soft if any source is
unavailable: write the partial rollup with a noted gap rather than
abort.

## Instructions

1. **Resolve the date.** Default to today (`YYYY-MM-DD`). If the user
   says "yesterday" or gives a date, use that.

2. **Gather in parallel.** Run these three lookups together — they
   don't depend on each other.

   - **Vault sweep:** read every file in `vault/raw/daily/` whose name
     starts with `<date>-` (excluding any existing `-rollup.md`). Also
     read `vault/raw/<date>*.md` if present. These are today's raw
     captures.
   - **Calendar:** call the Calendar MCP `list_events` for the date
     range `<date>T00:00 → <date>T23:59` on the user's primary
     calendar. Capture title, start/end, and attendees.
   - **GitHub:** call `search_issues` with
     `is:pr author:@me updated:<date>` and `is:issue author:@me
     updated:<date>` to find PRs and issues the user touched.

   If a source errors or is empty, note it as `(unavailable)` and
   continue.

3. **Synthesize.** Read all the gathered material and produce four
   sections:

   - **Wins** — concrete things shipped or decided. Prefer linkable
     evidence (PR URL, decision in a vault note).
   - **In flight** — work-in-progress with a one-line status.
   - **Blockers** — anything stuck. If unclear who/what it's waiting
     on, mark with `[?]` rather than guessing.
   - **Tomorrow** — at most three priorities for the next workday,
     plus any prep for scheduled meetings (read the next-day calendar
     entries to seed this).

4. **Write the rollup** to `vault/raw/daily/<date>-rollup.md` with the
   frontmatter described under Outputs. If a rollup already exists,
   add a `## Re-run <HH:MM>` section at the bottom rather than
   overwriting — the previous rollup may already be the user's
   reference.

5. **Report** the rollup path back to the user as the last line of the
   response.

## Inputs

| Input | Default | Notes |
|---|---|---|
| `date` | today | `YYYY-MM-DD`. Accept "yesterday" / "today". |
| `calendar_id` | `primary` | Override only if the user has a non-default work calendar. |
| `gh_query_extra` | empty | Extra GitHub search qualifiers (e.g. `org:tirtheshjani`). |

## Outputs

- `vault/raw/daily/<date>-rollup.md` with frontmatter:
  ```yaml
  ---
  date: <date>
  domain: productivity
  source: daily-rollup
  ---
  ```

## Example

Prompt: "wrap the day"

Output (truncated):
```markdown
---
date: 2026-05-10
domain: productivity
source: daily-rollup
---
# Daily rollup — 2026-05-10

## Wins
- Shipped Phase 1 of Agentic-OS scaffolding (PR #1, 10 commits).
- Decided on Next 16 over Next 15 for the dashboard (see vault/raw/2026-05-10-dashboard-stack.md).

## In flight
- Authoring priority skill bodies (Phase 2 — daily-rollup, vault-cleanup, …).

## Blockers
- shadcn registry is unreachable from this env [?]; using manual primitives for now.

## Tomorrow
1. Author morning-trend-scan + arxiv-daily-digest.
2. Smoke-test the dashboard's run history flow end-to-end.
3. 10:00 standup — prep PR #1 walkthrough.
```

## Troubleshooting

- **Calendar MCP returns 401.** The user's OAuth token has expired.
  Surface the error with the exact MCP message and stop — don't keep
  retrying.
- **No vault notes for the day.** This is fine; many days legitimately
  have no raw captures. Write the rollup with `_(no raw notes
  captured today)_` under Wins/In flight if those would otherwise be
  empty.
- **GitHub MCP rate-limited.** The `updated:<date>` query is cheap and
  rarely hits limits, but if it does, fall back to listing the user's
  most recent 20 PRs and filter client-side by date.
- **Existing rollup present.** Don't overwrite. Append a
  `## Re-run <HH:MM>` section so the user can compare.
