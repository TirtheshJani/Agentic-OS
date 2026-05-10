# Skill authoring standard

This standard is **derived from the official Anthropic Skills spec** and
"The Complete Guide to Building Skills for Claude". When in doubt, the
spec wins; this file just localizes it for our repo.

> Sources: [`anthropics/skills`](https://github.com/anthropics/skills),
> the Skills guide (Chapter 1 "Fundamentals", Chapter 2 "Planning and
> design", Reference B "YAML frontmatter").

## 1. Folder rules

- **Folder name:** kebab-case (`arxiv-daily-digest` ✅,
  `arxivDailyDigest` ❌, `arxiv_daily_digest` ❌).
- **Required file:** `SKILL.md` exactly (case-sensitive). No `skill.md`,
  no `SKILL.MD`.
- **Forbidden file:** `README.md` inside the skill folder. Per-skill human
  notes live in `references/`. (Repo-level README at `/README.md` is
  fine — that's outside any skill folder.)
- **Optional subfolders:**
  - `scripts/` — executable code (Python, Bash) for deterministic checks
    or transforms. Reference from SKILL.md by relative path.
  - `references/` — markdown documentation Claude loads on demand.
  - `assets/` — templates, fixtures, fonts used in output.

## 2. Frontmatter — only these top-level keys

| Key | Required | Notes |
|---|---|---|
| `name` | yes | kebab-case, must match folder name. **Reserved prefixes:** `claude`, `anthropic` — never use. |
| `description` | yes | WHAT + WHEN. Include trigger phrases users would actually say. ≤1024 chars. **No `<` or `>` anywhere.** |
| `license` | no | e.g. `MIT`. Use when shipping open-source. |
| `allowed-tools` | no | Restrict tool access, e.g. `"Bash(python:*) WebFetch"`. |
| `metadata` | no | Object. All custom fields live under here. |

Anything else at the top level is **invalid**. The validator
(`dashboard/scripts/validate-skills.mjs`) rejects it.

## 3. Local `metadata` convention

We use a small, consistent set of `metadata.*` fields so the dashboard can
group, badge, and filter:

```yaml
metadata:
  status: stub          # stub | authored
  domain: research/physics-ml
  mode: remote          # local | remote
  mcp-server: gmail     # name from .mcp.json or 'none'
  external-apis: [arxiv, semantic-scholar]
  outputs: [vault/wiki/research/physics-ml/arxiv-YYYY-MM-DD.md]
```

- `status: stub` — frontmatter only; body is a `TODO`. Dashboard shows a
  muted badge.
- `status: authored` — body has real instructions and has been smoke-tested.

## 4. Description field — what good looks like

```yaml
# Good — WHAT + WHEN + trigger phrases
description: Pull today's arXiv submissions in physics and ML categories,
  summarize each, and write a daily digest to
  vault/wiki/research/physics-ml/. Use when the user asks for "arxiv
  digest", "today's physics papers", "ML paper roundup", or "what's new
  on arxiv".

# Bad — too vague
description: Helps with research.

# Bad — missing triggers
description: Reads arXiv and writes summaries.
```

## 5. Body — progressive disclosure

- **Soft cap: 500 lines.** If you're approaching it, hierarchy + links to
  `references/*.md` are the answer, not deletion.
- **Recommended sections:**
  - `## Instructions` — numbered steps. Be specific and actionable; avoid
    "make sure to validate things properly" phrasing.
  - `## Inputs` — explicit defaults.
  - `## Outputs` — file paths or vault destinations.
  - `## Examples` — at least one.
  - `## Troubleshooting` — common errors and fixes.
- **Reference bundled resources clearly:**
  `Before writing queries, consult references/api-patterns.md.`

## 6. The five orchestration patterns

Pick one and name it in the SKILL.md so future readers know the shape:

1. **Sequential workflow orchestration** — N ordered steps, each gates the
   next. Use for onboarding-style flows.
2. **Multi-MCP coordination** — phases that span Gmail + Calendar +
   GitHub + Notion. Centralize error handling.
3. **Iterative refinement** — generate → validate → improve → re-validate.
   Use for reports, drafts, code reviews.
4. **Context-aware tool selection** — same outcome, different tools by
   context (file size, file type). Be explicit about the decision tree.
5. **Domain-specific intelligence** — embeds expert knowledge beyond raw
   tool access (e.g. compliance checks before payment processing).

## 7. Author checklist (before committing)

- [ ] Folder name kebab-case.
- [ ] `SKILL.md` exact filename.
- [ ] No `README.md` in the folder.
- [ ] Frontmatter has only `name`, `description`, `license`,
  `allowed-tools`, `metadata`.
- [ ] `description` ≤1024 chars, no `<` or `>`.
- [ ] `name` does not start with `claude` or `anthropic`.
- [ ] Body ≤500 lines OR linked references for the long parts.
- [ ] At least one example.
- [ ] `metadata.status` is `stub` or `authored` and reflects reality.
- [ ] `metadata.outputs` lists everything the skill writes.

The validator script enforces items 1–6 mechanically.
