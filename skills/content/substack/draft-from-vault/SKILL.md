---
name: draft-from-vault
description: Read recent vault/wiki/ entries on a topic the user names, draft a Substack post using the standard post template at assets/post-template.md, and write the draft to vault/outputs/. Use when the user asks for "draft a substack post on X", "turn my notes on X into a post", "newsletter draft for X".
license: MIT
metadata:
  status: authored
  domain: content/substack
  mode: remote
  mcp-server: canva
  external-apis: [none]
  outputs: [vault/outputs/<YYYY-MM-DD>-substack-<slug>.md]
---

# draft-from-vault

Orchestration pattern: **iterative refinement**. Generate a draft from
vault material, audit it through `avoid-ai-writing`, rewrite, then
re-audit. The loop runs up to twice; on the third pass the skill stops
and hands a "needs human pass" flag to the user.

This skill is for posts grounded in material the user has already
written or captured. For posts that require fresh outside research,
chain `deep-web-research` first and then run this skill against the
new wiki page. For audit-only work on an existing draft, use
`avoid-ai-writing` directly.

## References

- `assets/post-template.md` — the canonical Substack post shape. The
  drafter fills this in; do not reshape it.
- `references/hook-patterns.md` — four hook shapes that work and the
  ones to avoid. Consult before writing the "Why this, why now"
  section.
- `skills/content/avoid-ai-writing/SKILL.md` — required audit step.
  Every Substack draft this skill produces must pass through it.
- `skills/content/content-research-writer/SKILL.md` — voice and
  feedback patterns. Reuse for tone calibration when the user has
  prior writing samples to anchor on.
- `vault/CLAUDE.md` — vault folder rules. Substack drafts are finished
  deliverables and belong in `vault/outputs/`, not `wiki/` or `raw/`.
- Canva MCP (`mcp__claude_ai_Canva__generate-design`,
  `mcp__claude_ai_Canva__export-design`) — optional hero image. Skip
  when the user passes `--no-image` or omits an image request.

## Instructions

1. **Resolve the topic.** Restate the user's topic in one sentence.
   Pick a kebab-case `<slug>` (≤40 chars). Pick today's date in user
   TZ as `<YYYY-MM-DD>`. The target output path is
   `vault/outputs/<YYYY-MM-DD>-substack-<slug>.md`.

2. **Gather vault material.** Find every relevant entry under
   `vault/wiki/` and `vault/raw/`:
   - Match on the topic words and on tag overlap from the wiki page
     frontmatter.
   - Cap source count at `max_sources` (default 8). If more match,
     prefer wiki entries over raw, and newer over older.
   - If fewer than 2 sources match, stop and tell the user. Do not
     fabricate material to fill the gap. Suggest running
     `deep-web-research` or `morning-trend-scan` first.

3. **Outline.** Produce a 5- to 8-bullet outline keyed to the template
   sections (`TL;DR`, `Why this, why now`, `The argument`, `What I'd do
   with this`). Each bullet names the vault source that backs it. Do
   not write prose yet.

4. **Draft.** Open `assets/post-template.md` and fill it in:
   - `title` and `subtitle` are placeholders until step 7.
   - `date` is `<YYYY-MM-DD>`.
   - `tags` are the union of source tags, deduplicated, max 5.
   - Body sections follow the template order. Target 800-1500 words
     for the body. Cite vault sources inline as `[^1]` footnotes;
     keep a sources block at the bottom listing the vault path of
     each.
   - Match the user's voice. If prior Substack drafts exist under
     `vault/outputs/*-substack-*.md`, read the most recent two for
     tone before drafting.

5. **First audit.** Run the draft through `avoid-ai-writing` in
   `rewrite` mode with `context: blog`. Apply the rewrite. Re-check
   that no vault citation was dropped during the rewrite.

6. **Second audit (verification).** Run `avoid-ai-writing` in `detect`
   mode on the rewritten draft. If issues found is empty or only P2,
   the draft is clean. If P0 or P1 issues remain, loop once back to
   step 5 with the specific findings as guidance. Maximum two audit
   rounds; on the third round stop and flag in the draft header
   `status: needs-human-pass`.

7. **Headline pass.** Now that the body is stable, write the
   `title` (≤60 chars) and `subtitle` (≤120 chars). Use
   `references/hook-patterns.md`. The hook in "Why this, why now"
   should preview the title's promise, not restate it.

8. **Hero image (optional).** If the user did not pass `--no-image`,
   call Canva `generate-design` with a brief derived from the title
   and subtitle. Export PNG. Place the export URL in the draft
   frontmatter under `cover_image:`. If Canva fails, do not retry; log
   in the draft's hidden `## Notes` block and continue.

9. **Write.** Save the final draft to
   `vault/outputs/<YYYY-MM-DD>-substack-<slug>.md`. Re-running on the
   same slug overwrites only with explicit user confirmation; default
   is to append `-v2` to the slug.

## Inputs

- `topic` (required, string). Free text. Step 1 converts it to slug.
- `max_sources` (optional, int). Default 8.
- `voice_samples` (optional, list of paths). Extra files to read for
  tone before step 4.
- `cover_image` (optional, bool). Default true. False skips Canva.
- `force_overwrite` (optional, bool). Default false. True allows
  overwriting an existing same-day draft.

## Outputs

- `vault/outputs/<YYYY-MM-DD>-substack-<slug>.md` — the draft,
  template-shaped, AI-audited, citation-backed.
- Canva export URL (if image generated) — referenced inside the draft
  frontmatter as `cover_image`. The PNG itself lives in Canva, not
  the vault.

## Examples

User: "draft a substack post on what I learned wiring agent budgets to
real spend"

→ Step 1: slug `agent-budgets-real-spend`, date `2026-05-13`. Step 2:
finds `vault/wiki/business/agent-pricing.md` and three raw notes
from the prior two weeks. Five sources total. Step 3: 7-bullet
outline mapped to template sections. Step 4: 1180-word draft into
`assets/post-template.md` shape; footnotes 1-5 cite the vault
sources. Step 5: avoid-ai-writing finds three P1 issues
("leverage", "robust", one em dash); rewrite applied. Step 6: detect
mode returns one P2 ("significantly"); clean enough to stop. Step
7: title "Agent budgets only work when they map to real spend"
(56 chars), subtitle "Three months of usage logs and the line item
that finally tied them together." Step 8: Canva hero generated.
Step 9: written to
`vault/outputs/2026-05-13-substack-agent-budgets-real-spend.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Fewer than 2 vault sources match | Topic not covered in vault yet | Stop and suggest `deep-web-research` first; do not invent sources |
| Audit loop fires three times | Voice and AI-isms tangled | Stop, set `status: needs-human-pass`, flag in draft Notes block |
| Draft exceeds 1500 words after rewrite | Vault material too broad | Pick the single sub-argument and cut; offer to split into a series |
| Canva `generate-design` returns 4xx | Brief too vague or quota hit | Log in Notes, continue without image; user can rerun with manual brief |
| Same-day draft already exists | Re-run on same slug | Append `-v2` to slug unless `force_overwrite: true` |
| Citations missing after rewrite | avoid-ai-writing dropped footnotes | Re-insert from outline in step 3; rewrite mode should preserve `[^N]` markers but verify |
| Voice does not match prior posts | No `voice_samples` and no prior outputs | Ask the user for a sample paragraph before drafting; do not guess |
| Tags exceed 5 | Source tag union too large | Pick the 5 most-frequent across sources; drop the rest |
