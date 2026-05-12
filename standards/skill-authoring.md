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
  agent: Plan           # optional: Task subagent_type the dashboard suggests for runs
  cadence: M            # M | L | R | A (manual / local cron / remote cron / agent-loop)
```

The `agent` field is purely advisory. When the dashboard runs a skill, it surfaces the
suggested agent in the prompt panel and forwards it through the run API so an orchestrator
can spawn the right Task subagent. Common values: `general-purpose`, `Plan`, `Explore`,
`statusline-setup`, or a project-specific subagent name. Leave unset for ad-hoc skills.

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
- [ ] Service refs linked at the call site (see §8) when the skill
  touches GitHub / arXiv / Gmail / Calendar.

The validator script enforces items 1–6 mechanically.

## 8. Centralized references (deliberate spec deviation)

The Anthropic Skills spec expects per-skill `references/` folders so a
skill is self-contained when extracted. We deviate: shared service
references live at the **repo root** under `references/services/`
(github, arxiv, gmail, calendar). Skills link to them by relative path
at the call site:

```md
## Instructions

1. Read `../../../../references/services/github.md` for the rate-limit
   rules before any search call.
```

**Tradeoff.** A skill extracted to ship standalone is no longer
self-contained. The required mitigation: at extraction time, copy the
relevant `references/services/*.md` files into the skill's own
`references/` and update the link paths. The validator does not
enforce this — extraction is rare and the cost of catching it manually
is lower than the cost of N copies drifting.

**When per-skill `references/` is still correct:** content that is
specific to one skill (e.g. `arxiv-categories.md` listing the
categories *this* skill scans, not a general arXiv reference). The
per-skill folder remains the right home for those.

## 9. Centralized validators

Deterministic checks (parsing arXiv Atom, normalizing a PR reference,
confirming a triage report covers every rubric bucket) live at the
repo root under `scripts/validators/`, not inside each skill. Same
tradeoff as §8, same mitigation at extraction time.

A validator is a deterministic Python stdlib-only script that:

- Reads stdin or argv.
- Writes one JSON object to stdout.
- Exits 0 (ok), 1 (validation failed), or 2 (bug / bad input).

Skills invoke validators as Bash tool calls. The skill body links to
`scripts/validators/<name>.py` and documents which exit codes it
expects to see and what to do with each.
