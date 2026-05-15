---
name: weekly-rollup
description: Chain the last 7 days of upstream daily skill outputs (morning-trend-scan, daily-rollup, inbox-triage) into a single weekly digest written to vault/wiki/business/weekly-YYYY-Www.md. Use when asked for "weekly rollup", "weekly review", "recap this week", "week summary", "what happened this week", or "end of week review".
license: MIT
metadata:
  status: authored
  domain: business
  mode: remote
  mcp-server: none
  external-apis: []
  outputs: [vault/wiki/business/weekly-YYYY-Www.md]
---

# weekly-rollup

Orchestration pattern: **sequential workflow orchestration (skill
chaining)**. This skill is a downstream consumer — it does **not** call
external MCPs or APIs directly. It reads the previous 7 days of vault
artifacts produced by three upstream skills, aggregates them, and
synthesizes one ISO-week digest. Each step gates the next: window →
file discovery → per-source aggregation → synthesis → write.

Upstream skills in the chain (must have run during the window):

1. `research/general/morning-trend-scan` →
   `vault/raw/daily/YYYY-MM-DD-morning-scan.md`
2. `productivity/daily-rollup` →
   `vault/raw/daily/YYYY-MM-DD-rollup.md`
3. `business/inbox-triage` →
   `vault/raw/daily/YYYY-MM-DD-inbox-triage.md`

Output: `vault/wiki/business/weekly-YYYY-Www.md` (ISO week, e.g.
`weekly-2026-W19.md`).

## References

- `../../../productivity/daily-rollup/SKILL.md` — upstream rollup
  schema (sections: Did today, Decisions, Open threads, Tomorrow).
- `../../../research/general/morning-trend-scan/SKILL.md` — upstream
  scan schema (GitHub block, arXiv block, Notes).
- `../inbox-triage/SKILL.md` — upstream triage schema; **honor the
  privacy rule**: never include thread bodies or snippets in the
  weekly digest, only thread IDs and bucket counts.
- `../../../../vault/CLAUDE.md` — vault folder map and frontmatter
  conventions for the wiki page this skill writes.

## Instructions

### Step 1: Pin the ISO week window

Resolve `week_offset` (input, default `0`):

- `0` → current ISO week (Mon 00:00 → Sun 23:59, repo TZ).
- `-1` → last completed ISO week.
- `-N` → N weeks back.

Compute:

- `iso_year`, `iso_week` (e.g. `2026`, `19`) — use ISO 8601 week
  numbering (Mon = day 1, week containing Thu).
- `dates` = ordered list of 7 `YYYY-MM-DD` strings (Mon→Sun).
- `week_label` = `weekly-{iso_year}-W{iso_week:02d}`
  (e.g. `weekly-2026-W19`).

### Step 2: Discover upstream files

For each date `D` in `dates`, look for these three files:

```
vault/raw/daily/{D}-morning-scan.md
vault/raw/daily/{D}-rollup.md
vault/raw/daily/{D}-inbox-triage.md
```

Build a 7×3 presence matrix. Track missing cells — they are not
errors but feed the digest's "Coverage" section. **If all 21 cells
are missing**, abort with a clear message (the chain has no upstream
data to aggregate); do not write an empty wiki page.

### Step 3: Parse each present file

Read every present file and extract its salient fields. The upstream
schemas are stable — match section headers exactly.

**morning-scan files:**

- Under `## GitHub …`: collect bullet lines as `(repo, stars, blurb)`.
- Under `## arXiv …`: collect bullet lines as `(title, abs_url,
  category, first_author)`. Skip if the block is "Unavailable".
- Under `## Notes`: capture verbatim if non-empty (often explains
  fallbacks).

**daily-rollup files:**

- `## Did today` → bullets verbatim.
- `## Decisions` → bullets verbatim (these are first-class for the
  week).
- `## Open threads` → bullets verbatim; carry the `- [ ]` state.
- `## Tomorrow` → only meaningful for the last day; ignore otherwise.

**inbox-triage files:**

- Counts per bucket (Reply now, Reply later, Read & file, Archive,
  Spam/Promo, Escalations). Aggregate counts only.
- Escalations: keep `thread:<id>` references (IDs only — **never copy
  subjects/senders/bodies into the wiki page**, even though they
  appear in the raw file).

### Step 4: Aggregate across the week

Compute these rollups:

| Rollup | How |
|---|---|
| Top trending repos | Union of every morning-scan's GitHub list. De-dupe by repo URL. Sum-of-mentions wins ties over star count (cross-day persistence > one big day). |
| Notable papers | Union of arXiv lists. De-dupe by stripped arXiv ID. Keep papers that appeared ≥2 days or that the daily-rollup "Did today" referenced. |
| Decisions made | Concatenate all `## Decisions` bullets, with the date appended. |
| Shipped | Concatenate `## Did today` bullets that look like shipped artifacts (start with verbs: "Shipped", "Merged", "Published", "Wrote"). |
| Open threads carried | Union of `## Open threads` from the **most recent** daily-rollup that has them; older unchecked items have likely been resolved off-vault. |
| Inbox load | Sum each bucket across days. Surface the escalations IDs separately. |

### Step 5: Synthesize and write

Write to `vault/wiki/business/{week_label}.md` (overwriting if it
exists — re-runs of the same week are idempotent). Use this exact
shape:

```md
---
domain: business
source: weekly-rollup
created: <today YYYY-MM-DD>
updated: <today YYYY-MM-DD>
iso_week: <iso_year>-W<iso_week>
tags: [weekly, rollup]
---

# Week <iso_year>-W<iso_week>  (<Mon DD Mon> – <Sun DD Mon YYYY>)

## Summary
<2–3 sentence narrative: dominant theme, biggest shipped thing, any
open risk.>

## Coverage
- morning-scan: <N>/7 days
- daily-rollup: <N>/7 days
- inbox-triage: <N>/7 days
<one bullet per missing day, oldest first>

## Trending (GitHub, week union)
<top 10 repos by sum-of-mentions then stars>

## Notable papers (arXiv, week union)
<de-duped list, optional — empty section header if none>

## Decisions
<bulleted list, each suffixed `(YYYY-MM-DD)`>

## Shipped
<bulleted list>

## Open threads
<carried `- [ ]` items from the latest daily-rollup>

## Inbox load
- Reply now: <sum>   · Reply later: <sum>
- Read & file: <sum> · Archive: <sum>
- Spam/Promo: <sum>  · Escalations: <sum>
<if escalations >0: bulleted `thread:<id>` list — IDs only>

## Notes
<merged morning-scan Notes blocks; flag any upstream skill that ran
in a degraded mode>
```

### Step 6: Report

Respond with:

- Path of the written wiki page.
- Coverage line (e.g. `coverage: 7/7 rollup, 5/7 scan, 6/7 triage`).
- Counts: decisions, shipped items, open threads, escalations.

Do **not** echo Gmail thread subjects, senders, or body content in
the response — same privacy rule as `inbox-triage`.

## Inputs

| Input | Description | Default |
|---|---|---|
| `week_offset` | Which ISO week to aggregate. `0` = current, `-1` = last completed week, `-N` = N weeks back. | `0` |

## Outputs

- `vault/wiki/business/weekly-YYYY-Www.md` (single file per ISO week,
  overwritten on re-run).

## Examples

**Current week, Sunday evening run (the automation case):**

> "weekly rollup"
→ `week_offset=0`. Finds 7/7 daily-rollup, 5/7 morning-scan (Sat/Sun
gaps — automation is weekdays only), 7/7 inbox-triage. Writes
`vault/wiki/business/weekly-2026-W20.md`. Reports
`coverage: 7/5/7 · 14 decisions · 9 shipped · 3 open · 1 escalation`.

**Recap last week explicitly:**

> "recap last week"
→ `week_offset=-1`. Resolves to W19. Writes
`vault/wiki/business/weekly-2026-W19.md`.

**Backfill from a quiet week:**

> "weekly rollup for 4 weeks ago"
→ `week_offset=-4`. Finds 0/7 for all three sources → abort with a
note; do not create an empty wiki page.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Wiki page has empty Trending section | morning-scan was degraded all week (no GitHub MCP) | Check Notes block; restore MCP or accept the gap. |
| Decisions section empty | Daily rollups didn't include `## Decisions` headers | Upstream issue — fix `daily-rollup` parsing of decision markers. |
| Escalations IDs missing but count >0 | Triage file present but Escalations bucket header missing | Re-run `inbox-triage` for that day; the validator there enforces bucket coverage. |
| Wrong ISO week boundary | Resolved week numbering in non-ISO mode | Use ISO 8601 (Mon-first, Thu rule) — `date -d 'today' +%G-W%V` on GNU date. |
| Re-run on same week duplicates content | Append mode used by mistake | Overwrite, don't append — the week file is a single source of truth. |
| All three sources missing for a day | Skill chain didn't run that day | Coverage section records the gap; no action unless gap exceeds 2 days. |
