# Repo-internal service references

Service-level docs (rate limits, auth, common errors, gotchas) for the
external services that skills in this repo touch. Centralized here
rather than duplicated per-skill folder.

## Why centralized?

The Anthropic Skills spec recommends bundling references inside each
skill folder so the skill is self-contained and packageable as a
`.skill` zip. We deviate **for repo-internal use only**: this repo
doesn't package skills as standalone artifacts, and the cost of
keeping four copies of `github.md` in sync is real.

If a skill in this repo is ever extracted and shipped as a standalone
package, copy the relevant `references/services/*.md` into that
skill's `references/` folder before publishing.

The deviation is documented in `standards/skill-authoring.md` §8.

## Convention

A SKILL.md links to a service reference with a relative path from the
skill folder:

```markdown
## Instructions
...
Before calling the GitHub MCP, read
`../../../references/services/github.md` for the rate-limit shape and
common error codes.
```

The exact `../../../` count depends on the skill's depth in the
`skills/` tree. Don't try to abstract this — it's three levels for
two-deep skills (`skills/<domain>/<skill>/`), four for three-deep
skills (`skills/<top>/<sub>/<skill>/`).

## What lives here

| File | Used by skills that touch | Authored |
|---|---|---|
| `github.md` | morning-trend-scan, pr-review-prep, daily-rollup, issue-triage, repo-onboarding | yes |
| `arxiv.md` | arxiv-daily-digest, morning-trend-scan, paper-summary, healthcare-arxiv | yes |
| `gmail.md` | inbox-triage, comment-digest | yes |
| `calendar.md` | daily-rollup, calendar-prep | yes |

Add a row when you add a service. Add the file when at least two
skills will reference it; below that, prefer per-skill `references/`.
