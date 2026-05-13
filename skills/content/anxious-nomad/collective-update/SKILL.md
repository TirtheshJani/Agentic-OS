---
name: collective-update
description: Compile recent activity (members, milestones, blockers) into a community update for the Anxious Nomad collective and write to vault/outputs/. Use when the user asks for "collective update", "community update", "anxious nomad post".
license: MIT
metadata:
  status: authored
  domain: content/anxious-nomad
  mode: remote
  mcp-server: notion+spotify
  external-apis: [none]
  outputs: [vault/outputs/<YYYY-MM-DD>-anxious-nomad-update.md]
---

# collective-update

Orchestration pattern: **iterative refinement**. Pull source material, draft
the update, validate against a freshness/voice rubric, revise once if the
rubric flags anything, then attach the optional Spotify playlist. The loop
runs at most twice; never three times.

This skill writes the periodic Anxious Nomad community update — what
happened across the collective since the last post (new members,
milestones hit, blockers surfaced, content shipped). It is a finished
deliverable for an external audience, so it lives in `vault/outputs/`.

## References

- `vault/CLAUDE.md` — vault folder map; outputs vs. raw vs. wiki rules.
- `skills/content/avoid-ai-writing/SKILL.md` — run on the draft before
  marking the file final. The Anxious Nomad voice is conversational and
  specific; AI-isms break it harder than they break technical content.
- Notion MCP tools used here:
  - `mcp__claude_ai_Notion__notion-search` — locate the collective's
    member roster, project tracker, and update log databases.
  - `mcp__claude_ai_Notion__notion-fetch` — read database rows and pages.
  - `mcp__claude_ai_Notion__notion-get-users` — resolve mentions to real
    member names.
- Spotify MCP tools used here:
  - `mcp__claude_ai_Spotify__search` — find tracks by mood/theme.
  - `mcp__claude_ai_Spotify__create_playlist` — create the named playlist
    once track URIs are picked.

## Instructions

1. **Pin the window.** Default window is "since the last update post".
   Find the prior post by searching `vault/outputs/` for
   `*-anxious-nomad-update.md` and reading the latest one's `created`
   frontmatter date. If none exists, fall back to the last 30 days. Log
   the window inclusively in the draft header.

2. **Gather Notion sources in parallel.** Use one `notion-search` call to
   locate, in order:
   - the **member roster** database (search "Anxious Nomad members"),
   - the **project tracker** (search "Anxious Nomad projects"),
   - the **update log** (search "Anxious Nomad updates" or "collective
     log").
   For each database, `notion-fetch` rows modified inside the window.
   If any database returns zero rows, do not fabricate activity — note
   the gap in the draft's "Quiet corners" section.

3. **Classify activity into the four sections** the update uses:
   - **New members** — roster entries with `joined` date in the window.
     Pull the member's intro sentence (`bio` or `intro` column) verbatim.
   - **Milestones** — project tracker rows that flipped to `done` or
     hit a labeled milestone in the window.
   - **In flight** — projects with `status: active` and at least one
     update inside the window.
   - **Blockers** — projects with `status: blocked` OR member-flagged
     items in the update log tagged `help-needed` / `stuck`.
   Resolve every Notion person-mention with `notion-get-users` so the
   draft says "Maya Chen", not `@user_id`.

4. **Draft the update.** Use the template in §"Update template" below.
   Voice notes: warm, plainspoken, second person ("you" when addressing
   the collective). No corporate cheer, no "we're thrilled to". Lead
   with one specific story or moment from the window, not a status
   summary. Sentence-case headings.

5. **Validate against the freshness rubric.** A draft passes when:
   - Every section has at least one concrete name, project, or quote.
     A section with only generic phrasing fails.
   - The lead is one specific moment, not a windowed summary.
   - No section is longer than 180 words; the whole draft is under 800.
   - No em dashes, no AI-ism Tier 1 words (run a quick mental scan; the
     `avoid-ai-writing` skill is the formal pass at step 7).
   If the rubric fails, revise the failing sections **once**. Do not
   loop a second time; if it still fails, surface the issue to the user
   and ask which section to keep, cut, or expand.

6. **Optional Spotify playlist.** Skip this step if the user passed
   `--no-playlist`. Otherwise:
   - Pick 8–12 tracks whose mood matches the window's emotional arc
     (read the draft you just wrote; that is the brief).
   - `mcp__claude_ai_Spotify__search` for each candidate, capture the
     track URI.
   - `mcp__claude_ai_Spotify__create_playlist` with name
     `Anxious Nomad — <YYYY-MM>` (em dash is fine **inside the Spotify
     name** because Spotify titles are not prose; everywhere else the
     em-dash rule holds).
   - Embed the playlist URL in the draft's closing section under a
     "Soundtrack" subhead.

7. **Polish pass.** Run the `avoid-ai-writing` skill in `detect` mode on
   the draft. Fix every P0 and P1 hit. P2 hits are judgment calls.

8. **Write the file** to
   `vault/outputs/<YYYY-MM-DD>-anxious-nomad-update.md` where the date
   is today (user TZ). Idempotent: re-running on the same day
   overwrites. If a same-day file exists from a prior run, preserve
   its `created` date in frontmatter and bump `updated`.

## Inputs

- `window_start` (optional, ISO date). Default: prior update post date.
- `window_end` (optional, ISO date). Default: today.
- `--no-playlist` (optional flag). Skips step 6.
- `notion_workspace` (optional, string). Override if the collective
  lives outside the default workspace.

## Outputs

- `vault/outputs/<YYYY-MM-DD>-anxious-nomad-update.md` — the finished
  community update, ready to copy into Substack or the collective's
  Notion page.

## Update template

```md
---
domain: content/anxious-nomad
source: collective-update
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [anxious-nomad, community-update]
window: <window_start> to <window_end>
---

# <Plain sentence-case title referencing one moment from the window>

<Opening: 2–4 sentences leading with a specific scene, quote, or
moment. No summary framing.>

## New members

<Name + their own intro sentence. One short paragraph per new member,
or a single paragraph if there are 1–2 of them.>

## Milestones

<Specific projects that shipped or hit a labeled milestone. Name the
project, name the person, name what changed.>

## In flight

<Active projects with movement in the window. One sentence each. Link
to the project page in Notion if useful.>

## Blockers (or: where you can help)

<Things stuck or asking for help. Phrased as invitations, not status
updates.>

## Quiet corners

<Optional. Use only if a usual section had zero activity worth
naming. Be honest, not apologetic.>

## Soundtrack

<Playlist line, e.g. "Anxious Nomad — 2026-05 →
https://open.spotify.com/playlist/...">

<Closing line: one sentence. Sign off with a real name, not "the
team".>
```

## Examples

User: "collective update"

→ Step 1: prior post dated 2026-04-22; window is 2026-04-22 to today
(2026-05-13). → Step 2: Notion search finds three databases; fetch
returns 2 new member rows, 4 milestone flips, 7 active projects, 2
blocked projects. → Step 3: resolved 6 user mentions. → Step 4: draft
written, opening with Maya's note about her first solo trip in three
years. → Step 5: rubric passes first try. → Step 6: 10-track playlist
created, mood-matched to the window's slow-travel-and-recovery arc;
URL embedded. → Step 7: `avoid-ai-writing` flagged "vibrant" and one
em dash; both fixed. → Step 8: file written to
`vault/outputs/2026-05-13-anxious-nomad-update.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| All Notion searches return zero results | Workspace mismatch | Pass `notion_workspace` explicitly; the MCP defaults to the personal workspace |
| Member rows missing `intro` text | Roster column renamed | `notion-fetch` the database schema first, map to the new column name, log the change in the draft Notes |
| Draft fails the rubric on "lead is summary, not moment" | Skipped step 4 voice notes | Open the update log, pick one dated entry that has emotional specificity, rewrite the lead from that |
| `create_playlist` 401 | Spotify token expired | Re-auth via the Spotify MCP; if blocked, skip step 6 and add a "Soundtrack: TBD" line so the user can add it manually |
| Playlist name collides with prior month | Re-ran the skill in the same calendar month | Append `-v2` to the playlist name; do not overwrite |
| Same-day output file already exists | Re-running today | Preserve `created`, bump `updated`, overwrite body |
| Update reads as a corporate digest | Skipped the voice notes in step 4 | Cut every adjective that could appear in a press release; rewrite each section lead as a story sentence |
