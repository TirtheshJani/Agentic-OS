---
name: newsletter-roundup
description: Curate the week's links from vault/raw/ tagged for the newsletter, group thematically, and produce a roundup draft. Use when the user asks for "newsletter roundup", "weekly links", "anxious nomad newsletter".
license: MIT
metadata:
  status: authored
  domain: content/anxious-nomad
  mode: remote
  mcp-server: canva
  external-apis: [none]
  outputs: [vault/outputs/<YYYY-MM-DD>-newsletter.md]
---

# newsletter-roundup

Orchestration pattern: **sequential workflow**. Five ordered stages
(scan → cluster → draft → cover image → polish), each gates the next.
Stage 4 (Canva cover image) is fail-soft: if Canva is unavailable, the
draft still ships with a `cover: TBD` line.

This is the Anxious Nomad weekly/biweekly newsletter. The roundup
pulls from three vault sources — daily notes tagged for inclusion,
finished outputs from the prior period, and trend-scan digests — then
groups items thematically and adds a short editorial intro. It is a
finished deliverable, so it writes to `vault/outputs/`.

## References

- `vault/CLAUDE.md` — folder map. Outputs go to `vault/outputs/`; raw
  daily notes live in `vault/raw/daily/`.
- `skills/research/general/morning-trend-scan/SKILL.md` — produces the
  trend-scan digests this skill consumes as a link source.
- `skills/content/avoid-ai-writing/SKILL.md` — final polish pass.
- `references/services/canva.md` — auth scopes, generative rate caps,
  transaction lifecycle, brand-kit fallbacks.
- Canva MCP tools used here:
  - `mcp__claude_ai_Canva__list-brand-kits` — pull the Anxious Nomad
    palette once per session and cache the kit ID in memory.
  - `mcp__claude_ai_Canva__generate-design` — produce the cover image.
  - `mcp__claude_ai_Canva__export-design` — get the PNG URL to embed.

## Instructions

1. **Stage 1 — Scan the vault.** Pick the period (default: last 7
   days). Collect three input streams:
   - **Tagged daily notes:** every file under `vault/raw/daily/` whose
     frontmatter `tags` includes `newsletter` OR whose body has a
     `## Newsletter` section. Use the Grep tool, not a free-text
     search.
   - **Finished outputs:** every file under `vault/outputs/` with
     `created` inside the period. These are usually internal pieces
     worth surfacing.
   - **Trend-scan digests:** every file matching
     `vault/raw/daily/<DATE>-morning-scan.md` inside the period.
     Extract only links the user has annotated (a `→` arrow, a star,
     or a `[keep]` tag); ignore the rest. The morning scan is noisy
     by design and most of it is not newsletter-worthy.
   Deduplicate by URL across all three streams.

2. **Stage 2 — Cluster thematically.** Group links into 3–5 themes.
   Themes are emergent, not fixed; do not force a "Tech" or "Life"
   bucket. Name each theme as a short clause (e.g., "What slow travel
   actually feels like", "Tools I stopped using"). Each cluster needs
   at least 2 items, or it gets merged into a neighbor.

   If fewer than 6 items survive deduplication, do not run a roundup.
   Surface this to the user and ask whether to wait a week or write
   a different kind of post.

3. **Stage 3 — Draft.** Use the template in §"Newsletter template"
   below. Every item gets:
   - The link's title (or a rewritten human title if the original is
     SEO-stuffed).
   - The URL.
   - A one- or two-sentence editorial gloss in the Anxious Nomad
     voice — what this is, why it is in this newsletter, and (where
     honest) what the user actually thinks about it. No "worth a
     read"; say something specific or cut the item.
   The opening intro is 2–4 sentences. It frames the theme of the
   issue and references one specific item readers will see below.

4. **Stage 4 — Cover image (Canva, fail-soft).**
   - On first run of the session, call `list-brand-kits` and find the
     kit named "Anxious Nomad" (or the user's override). Store its ID.
     If no kit matches, log a Notes entry and use Canva defaults.
   - Call `generate-design` with the issue title as the design brief
     and the brand kit ID. Choose a portrait or square format; the
     newsletter platform crops landscape covers badly.
   - Call `export-design` for the PNG. Embed the PNG URL near the top
     of the draft, under the title.
   - On any Canva error (auth, rate limit, unknown brand kit), write
     `cover: TBD — Canva error: <message>` in frontmatter and proceed.
     Do not retry more than once per stage.

5. **Stage 5 — Polish.** Run the `avoid-ai-writing` skill in `detect`
   mode on the draft. Fix every P0 and P1 finding. The Anxious Nomad
   voice is the product; AI-isms here are the loudest brand failure
   mode. Check the link-gloss density: if more than one gloss uses
   the same opening word, rewrite. Write the file to
   `vault/outputs/<YYYY-MM-DD>-newsletter.md`.

## Inputs

- `period_days` (optional, int). Default: 7.
- `period_start` (optional, ISO date). Default: today − `period_days`.
- `period_end` (optional, ISO date). Default: today.
- `min_items` (optional, int). Default: 6. Below this, do not run.
- `cover_format` (optional). `portrait` | `square`. Default `square`.
- `brand_kit_name` (optional). Default: "Anxious Nomad".

## Outputs

- `vault/outputs/<YYYY-MM-DD>-newsletter.md` — the issue draft, ready
  to paste into Substack or the user's newsletter tool. Cover image
  is a Canva-hosted URL embedded in the draft (Canva keeps the asset;
  the vault stays light).

## Newsletter template

```md
---
domain: content/anxious-nomad
source: newsletter-roundup
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
period: <period_start> to <period_end>
cover: <canva PNG URL or "TBD — <reason>">
tags: [anxious-nomad, newsletter]
---

# Issue <N>: <human title pulled from the dominant theme>

![cover](<cover URL>)

<Intro: 2–4 sentences. Frames the theme. Names one item below.>

## <Theme 1 — short clause>

- **<Item title>** — <URL>
  <One- or two-sentence editorial gloss.>
- **<Item title>** — <URL>
  <Gloss.>

## <Theme 2>
...

## From the vault

<Optional. Links to user's own outputs from the period, with a one-
sentence framing. Skip the section if nothing fits.>

## Sign off

<One- or two-sentence closing line. Real, specific, signed.>
```

## Examples

User: "newsletter roundup"

→ Stage 1: 14 candidate items pulled (6 daily-note tags, 2 vault
outputs, 6 starred trend-scan links). Dedupe to 11. → Stage 2:
three themes emerge — "Travel without a plan", "Tools that earned
their keep", "Quiet wins from the collective". → Stage 3: draft
written, intro leads with the Maya post from the collective. →
Stage 4: Canva brand kit "Anxious Nomad" found, square cover
generated and exported, URL embedded. → Stage 5: `avoid-ai-writing`
flagged "vibrant" twice and one "let's dive in"; all fixed. File
written to `vault/outputs/2026-05-13-newsletter.md`.

User: "newsletter roundup, period 14 days"

→ Same flow with `period_days=14`. 23 candidates after dedupe; four
themes; otherwise identical.

User: "newsletter roundup" but only 4 tagged items exist

→ Stage 2 short-circuits. Skill surfaces: "Only 4 items found; the
roundup needs at least 6. Wait a week, lower the threshold, or
write a single-topic post instead?"

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Zero tagged daily notes | Tags not yet applied to the period | Ask the user to skim daily notes and tag with `newsletter`, then re-run |
| Same item appears twice under different themes | Cluster ambiguity in stage 2 | Pick the better-fitting theme; do not surface an item twice |
| Canva `generate-design` 401 | Auth expired | Re-auth via Canva MCP; if blocked, write `cover: TBD` and proceed |
| Cover image is landscape, gets cropped | Forgot to pass `cover_format` | Default is `square`; pass `portrait` for platforms that prefer it |
| Trend-scan links flood the issue | Step 1 captured all links instead of only annotated ones | Re-filter; only links marked `→`, `*`, or `[keep]` qualify |
| Glosses sound interchangeable | Voice failure | Cut every "worth reading" / "interesting take"; replace with the actual reason the link is in the issue |
| Same-day output already exists | Re-running today | Bump `updated`, preserve `created`, overwrite body |
