# Service references

Centralized references for MCP and external API services used by skills
in this repo. One file per service, regardless of how many skills use it.

Why centralized: when GitHub's rate-limit numbers change or arXiv's
schema shifts, the fix lands in one place instead of N skill folders.

**Tradeoff documented in `standards/skill-authoring.md` §8.** If a
skill is ever extracted to ship standalone (per the Anthropic Skills
spec, which expects `references/` inside the skill folder), the
relevant file must be copied into that skill's own `references/`.

## Files

| File | Used by |
|---|---|
| `github.md` | morning-trend-scan, pr-review-prep, issue-triage, repo-onboarding, weekly-rollup |
| `arxiv.md` | arxiv-daily-digest, morning-trend-scan, healthcare-arxiv, paper-summary |
| `gmail.md` | inbox-triage, comment-digest |
| `calendar.md` | daily-rollup, calendar-prep, weekly-rollup |
| `notion.md` | weekly-rollup, collective-update, engagement-report |
| `canva.md` | newsletter-roundup, draft-from-vault |
| `drive.md` | deep-web-research (foundational; anticipated reuse) |
| `pubmed.md` | pubmed-digest |
| `semantic-scholar.md` | paper-summary |

## What goes in each ref

- Auth scopes (MCP scope strings or token requirements).
- Rate limits with the actual numbers and the headers that report them.
- Tool selection — when to reach for which tool, and which alternative
  to skip.
- Common error decoding (status codes + meaning + remediation).
- Gotchas — the things that bite once per project.

## What does not go in each ref

- Skill-specific workflows. Those live in the skill's `SKILL.md`.
- Secrets, tokens, example credentials.
- Anything that changes per-skill (output paths, prompt templates).
