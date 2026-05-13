---
name: substack-publish-prep
description: Take a finalized draft, generate a short headline, subhead, social blurb, three image prompt options, and a publish checklist; write the package next to the draft. Use when the user asks for "prep this for substack", "publish package", "social copy for this post".
license: MIT
metadata:
  status: authored
  domain: content/substack
  mode: remote
  mcp-server: none
  external-apis: [none]
  outputs: [vault/outputs/<draft-slug>-publish-pkg.md]
---

# substack-publish-prep

Orchestration pattern: **sequential workflow**. Seven ordered stages
that transform a finished draft into a paste-ready publishing package.
Each stage gates the next. There is no loop; Substack has no
publishing API, so the deliverable is markdown the user pastes into
the Substack web editor plus a checklist they tick off in the same
session.

This skill assumes the draft is already clean. Run `draft-from-vault`
or `content-research-writer` first; run `avoid-ai-writing` on the
draft if it has not been audited. This skill does not rewrite the
draft body.

## References

- `references/publishing-checklist.md` — Substack field limits, email
  fields, supported embeds, and what Substack cannot do. Consult
  before stages 2 and 7.
- `skills/content/avoid-ai-writing/SKILL.md` — audit step run on the
  generated social copy and headline candidates. Social blurbs are
  short and a single AI-ism stands out more than in long-form.
- `skills/content/substack/draft-from-vault/SKILL.md` — the upstream
  skill that produces the draft this one consumes.
- `vault/CLAUDE.md` — the publishing package is a finished deliverable
  and belongs alongside the draft in `vault/outputs/`.

## Instructions

1. **Locate the draft.** Resolve `draft_path`. If the user gave a slug
   only, expand to `vault/outputs/<YYYY-MM-DD>-substack-<slug>.md`.
   Read the file. Extract: existing `title`, `subtitle`, `tags`,
   `date`, body word count, footnote count, embedded URLs. If the
   draft has `status: needs-human-pass` in frontmatter, stop and tell
   the user to finish the draft first.

2. **Headline candidates.** Generate three headlines, each ≤60 chars
   (Substack soft limit per `references/publishing-checklist.md`).
   Vary the shape: one concrete-moment, one sharp-claim, one
   one-number. Score each on: specificity (front-loads the
   distinguishing term), reading-difficulty (8th-grade target),
   email-subject suitability. Mark the recommended pick.

3. **Subtitle candidates.** Generate two subtitles, each ≤120 chars.
   Each must add information the headline does not, not restate it.

4. **Social blurbs.** Generate three blurbs for cross-posting:
   - Twitter/X: ≤280 chars, one link slot at the end.
   - LinkedIn: 600-1200 chars, three short paragraphs, no hashtags
     unless the user explicitly asks.
   - Substack Notes: ≤300 chars, one strong line, link last.
   Each blurb pulls a specific fact or quote from the draft body. No
   generic teasers ("read my new post").

5. **Image prompts.** Three Canva-ready prompt options for the hero
   image, each one sentence with concrete subject + style + mood. The
   user picks one and either calls Canva manually or asks
   `draft-from-vault` to re-run image generation. Also write alt text
   for whichever image gets used (≤125 chars, describes the visible
   content not the meaning).

6. **AI-writing audit.** Run all candidates from stages 2-4 through
   `avoid-ai-writing` in `detect` mode with `context: linkedin` (for
   social) and `context: blog` (for headline and subtitle). Replace
   any candidate that returns P0 or P1 findings. Re-audit until clean
   or until two passes; on a third pass mark the candidate
   `needs-human-pass` and continue.

7. **Compile the publish package.** Write a single markdown file to
   `vault/outputs/<draft-slug>-publish-pkg.md` using the package
   template below. The file is paste-ready: every section is a
   discrete block the user copies into the matching Substack field.

8. **Final checklist.** Append the pre-publish smoke-test checklist
   from `references/publishing-checklist.md` to the package, with
   checkboxes ready for the user to tick off in the Substack editor.

## Inputs

- `draft_path` (required, string). Absolute or repo-relative path to
  the draft markdown file. Or a slug if the file lives in
  `vault/outputs/`.
- `audience` (optional). `free` | `paid` | `paid-trial`. Default
  `free`.
- `cross_post_targets` (optional, list). Subset of
  `["twitter", "linkedin", "notes"]`. Default all three.
- `hashtags_linkedin` (optional, bool). Default false.

## Outputs

- `vault/outputs/<draft-slug>-publish-pkg.md` — the paste-ready
  package plus the checklist. Lives next to the draft so both travel
  together in git.

## Publish package template

```md
---
draft: <draft-filename>
prepared: <YYYY-MM-DD>
audience: <free|paid|paid-trial>
---

# Publish package — <draft slug>

## Headlines (≤60 chars)
1. <option A> — concrete-moment — RECOMMENDED
2. <option B> — sharp-claim
3. <option C> — one-number

## Subtitles (≤120 chars)
1. <option A>
2. <option B>

## Social copy

### Twitter / X (≤280)
<blurb>

### LinkedIn (600-1200)
<blurb>

### Substack Notes (≤300)
<blurb>

## Hero image
### Prompts (pick one)
1. <prompt A>
2. <prompt B>
3. <prompt C>

### Alt text (≤125)
<alt text for the chosen image>

## Tags (≤5)
<tag, tag, tag>

## Email
- Subject (≤60): <headline or override>
- Pre-header (≤90): <subtitle or override>

## Pre-publish checklist
- [ ] Email subject under 60 chars
- [ ] Subtitle adds information (does not restate headline)
- [ ] Cover image alt text filled
- [ ] Footnotes render in preview
- [ ] All external links open correctly
- [ ] Cross-post toggles set (Notes, recommendations)
- [ ] Audience setting matches intent
```

## Examples

User: "prep 2026-05-13-substack-agent-budgets-real-spend for publish"

→ Stage 1: draft loaded, 1180 words, 5 footnotes, status `draft`.
Stage 2: three headlines generated; recommend "Agent budgets need
real-spend lines" (38 chars, concrete). Stage 3: two subtitles;
preferred adds the timeframe and the line item name. Stage 4:
Twitter blurb cites the 83% number from footnote 2; LinkedIn pulls
the "three months of logs" anecdote; Notes uses the single sharpest
sentence. Stage 5: three image prompts (one workspace photo, one
abstract chart, one diagram). Stage 6: detect-mode audit flags
"leverage" in the LinkedIn draft; replaced with "use". Stage 7:
package written to
`vault/outputs/2026-05-13-substack-agent-budgets-real-spend-publish-pkg.md`.
Stage 8: checklist appended with seven unticked boxes.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Draft has `status: needs-human-pass` | Upstream audit loop hit max | Stop, tell user to finish the draft before prep |
| Headline candidates all exceed 60 chars | Topic is intrinsically long | Drop articles ("the", "a"); compress the second clause; cut to 60 hard |
| Social blurbs read as generic teasers | Skipped step 4 fact-pull | Re-read draft body, pick a specific number or quote; rewrite the blurb around it |
| LinkedIn blurb under 600 chars | Pulled too thin a quote | Expand with the second-most-specific fact; do not pad with adjectives |
| Audit finds P0 on every candidate | Generator stuck on AI vocabulary | Switch the generator's seed phrasing; do not iterate more than twice |
| User asks for hashtags on LinkedIn | Default off | Honor `hashtags_linkedin: true`; cap at 3, lowercase, end of post |
| Substack tag count >5 | Draft tags exceed limit | Pick 5 most-relevant; document which were dropped in package frontmatter |
| Package file already exists | Re-run on same draft | Overwrite; the package is derivative and the draft is the source of truth |
