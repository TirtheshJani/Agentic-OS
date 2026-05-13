---
name: engagement-report
description: Aggregate weekly engagement metrics across content surfaces (Substack opens, Notion shares) and write a one-page report. Use when the user asks for "engagement report", "weekly metrics", "how did the content do".
license: MIT
metadata:
  status: authored
  domain: content/community
  mode: remote
  mcp-server: notion
  external-apis: [substack]
  outputs: [vault/wiki/content/community/engagement-YYYY-WW.md]
---

# engagement-report

Orchestration pattern: **domain-specific intelligence**. The skill's
value is not just pulling numbers; it is the rubric that decides what
counts as engagement on each surface and which signals matter for the
Anxious Nomad audience. Each channel has its own auto-pull path or its
own manual-entry template, and the report combines them under one
shared scoring model.

Channels covered:
- **Substack** — auto-pull if a Substack API key is configured; manual
  template otherwise.
- **Notion shares** — auto-pull via the Notion MCP (page views, share
  counts on the collective workspace).
- **YouTube, social, podcast** — manual entry; the skill prints the
  template, the user fills it.

The output is a one-page weekly report keyed by ISO week, written to
`vault/wiki/content/community/`. Reports accumulate over time as a
wiki series.

## References

- `vault/CLAUDE.md` — wiki frontmatter shape.
- `skills/content/community/comment-digest/SKILL.md` — the comment-side
  companion (qualitative engagement); this skill is quantitative.
  If both run in the same session, the report links the digest.
- `skills/content/avoid-ai-writing/SKILL.md` — apply to the analyst
  notes at the bottom of the report, not to the metric tables.
- Notion MCP tools used here:
  - `mcp__claude_ai_Notion__notion-search` — locate shared collective
    pages.
  - `mcp__claude_ai_Notion__notion-fetch` — read page metadata.
- Substack API — see §"Substack auto-pull" below for the endpoints
  used. No dedicated MCP; called via WebFetch with a bearer token from
  the environment (`SUBSTACK_API_KEY`).

## Instructions

1. **Pin the ISO week.** Default: the most recently completed ISO week
   (Mon–Sun). `YYYY-WW` is the filename key. Reports always cover
   complete weeks; mid-week runs report the prior week.

2. **Decide auto vs. manual per channel.** For each channel, run the
   small probe and route:
   - Substack: read env `SUBSTACK_API_KEY`. If present, auto-pull;
     else fall through to manual.
   - Notion: always auto-pull. If the MCP errors, mark the section
     `(manual)` and add the template rows.
   - YouTube, Instagram, TikTok, podcast: always manual. The skill
     does not have credentials for these and will not invent metrics.

3. **Substack auto-pull** (only if API key present). Call:
   - `GET https://substack.com/api/v1/publication/<slug>/posts?published_since=<ISO>`
     — list posts published in the week.
   - For each post: `GET .../posts/<id>/stats` — opens, clicks,
     subscribes-from-post, unsubscribes-from-post.
   - `GET .../subscriber_stats?since=<ISO>&until=<ISO>` — net subs
     for the week.
   Cap at 6 requests per minute. If a call 4xx's, drop into manual
   mode for that channel and log the error in Notes. Never approximate
   missing numbers.

4. **Notion auto-pull.** Search for shared collective pages
   (`mcp__claude_ai_Notion__notion-search`, filter to pages, scope to
   the Anxious Nomad workspace). For each result, `notion-fetch` and
   capture: page title, last-edited timestamp, public-share flag, and
   any view-count metadata the API exposes (Notion is stingy here;
   often only public-share status is available). If view counts are
   not exposed, note `views: n/a` and rely on share-flag deltas.

5. **Manual channel template.** For every manual channel, print the
   template inline in the report with `?` placeholders the user fills
   in:
   ```
   ## <Channel name> (manual)
   - posts this week: ?
   - reach / views: ?
   - engagement (likes + comments + shares): ?
   - net followers: ?
   - notable response: ?
   ```
   Do not fabricate values. A blank report with `?` placeholders is
   correct; a populated report with invented numbers is a bug.

6. **Apply the rubric.** For each channel that has numeric data,
   compute and surface:
   - **Trend vs. prior week** — read the prior week's report from
     `vault/wiki/content/community/engagement-<YYYY-WW-1>.md` if it
     exists; compute deltas. First-ever report skips this.
   - **Engagement rate** — engaged actions ÷ reach. Where reach is
     unknown, write `engagement rate: n/a`.
   - **One signal worth investigating** — the largest positive or
     negative delta, named with its likely cause if the user has left
     hints in `vault/raw/daily/` (one quick Grep on the post title).
   The rubric is deliberately conservative. Do not declare a "win" or
   "loss" — the skill reports numbers and one investigation prompt;
   the user judges.

7. **Compose the report.** Use the template in §"Report template"
   below. Tables for the quantitative sections; one short prose
   "Analyst notes" paragraph at the bottom (2–4 sentences). Run
   `avoid-ai-writing` in detect mode on the prose only.

8. **Write the file** to
   `vault/wiki/content/community/engagement-<YYYY-WW>.md`. This is a
   wiki page, not a finished deliverable; it accumulates as a series.

## Inputs

- `iso_week` (optional, string `YYYY-WW`). Default: most recent
  completed week.
- `channels` (optional, list). Default:
  `["substack","notion","youtube","instagram","podcast"]`. Override to
  trim or add.
- `prior_week_path` (optional, string). Override for delta comparison
  if the default naming is wrong.

## Outputs

- `vault/wiki/content/community/engagement-<YYYY-WW>.md` — one wiki
  page per week. The series builds a longitudinal view.

## Report template

```md
---
domain: content/community
source: engagement-report
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
iso_week: <YYYY-WW>
tags: [community, engagement, metrics]
---

# Engagement report — <YYYY-WW>

Week of <Mon-date> to <Sun-date>.

## Substack <(auto) | (manual)>

| Post | Opens | Open rate | Clicks | Subs+ | Unsubs |
|---|---|---|---|---|---|
| <title> | <n> | <pct> | <n> | <n> | <n> |

Net subscribers this week: <n> (prior week: <n>, Δ <n>).

## Notion shared pages (auto)

| Page | Last edited | Public? | Views |
|---|---|---|---|
| <title> | <date> | yes/no | <n or n/a> |

## YouTube (manual)
- posts this week: ?
- reach / views: ?
- engagement: ?
- net followers: ?
- notable response: ?

## Instagram (manual)
<same template>

## Podcast (manual)
<same template>

## Trend vs. prior week

| Channel | Metric | This week | Prior week | Δ |
|---|---|---|---|---|
| Substack | open rate | <pct> | <pct> | <±pct> |
| Substack | net subs | <n> | <n> | <±n> |
| Notion | shared pages | <n> | <n> | <±n> |

(First-ever report: section omitted.)

## Signal worth investigating

<One bullet, naming the largest delta and the likely cause if the
daily notes hint at one. Otherwise: "no daily-note context found".>

## Analyst notes

<2–4 sentences. Plain prose. No predictions, no cheerleading. What
the numbers describe and where the user might look next.>

## Notes

<Run metadata: which channels auto-pulled, which fell back to
manual, any API errors, link to comment-digest report if run in the
same session.>
```

## Examples

User: "engagement report"

→ Today is 2026-05-13 (Wed). Most recent completed ISO week is
`2026-19` (May 4–10). Substack API key present → auto-pull: 2 posts,
opens 1,840 and 1,205, open rates 48 percent and 41 percent, net subs
+12. Notion auto-pull: 4 shared collective pages, views unavailable.
YouTube/Instagram/podcast: manual templates printed with `?`. Prior
week file `engagement-2026-18.md` exists; deltas computed. Signal: open
rate down 7 points vs. prior week; daily-note grep finds a 2026-05-07
entry mentioning a subject-line A/B test that lost — surfaced as the
investigation prompt. Analyst notes: two sentences. File written.

User: "engagement report for 2026-15"

→ Same flow but pinned to ISO week 2026-15.

User: "engagement report" with no `SUBSTACK_API_KEY`

→ Substack section uses the manual template. Everything else
unchanged. Notes log: `substack: manual (no API key in env)`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Substack 401 | Token expired | Drop to manual for the week; log error in Notes; ask user to refresh `SUBSTACK_API_KEY` |
| Substack 429 | Burst tripped the 6/min cap | Sleep and retry once; if still 429, drop to manual for unfinished posts |
| Notion search returns paged results truncated | Workspace has many pages | Tighten the search query to a collective-specific keyword; do not paginate exhaustively |
| Prior-week file missing for first ever report | First run | Skip the Trend section; note "first report in series" in Notes |
| Manual template auto-filled with zeros | Fabrication bug | Stop. Replace with `?` placeholders. Zeros are a real measurement, not a default |
| `engagement rate: n/a` on every Substack row | Reach numerator/denominator confusion | Use opens ÷ delivered, not opens ÷ subscribers; the API distinguishes them |
| Report contains "great week!" / "exciting growth" | Voice failure in Analyst notes | Strip; the rubric is conservative. Numbers, one investigation prompt, no verdicts |
| Filename collides with re-run | Re-running same ISO week | Preserve `created`, bump `updated`, overwrite |
