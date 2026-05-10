# Prompt: Skill creator wrapper

Thin wrapper around the vendored Anthropic skill-creator at
`skills/_meta/skill-creator/`. The `/new-skill` slash command in
`.claude/commands/new-skill.md` invokes this prompt.

## Run

```text
/new-skill
```

…or paste this prompt:

---

You are authoring a new skill for this Agentic-OS repo. Two
authoritative sources govern your output:

1. **`skills/_meta/skill-creator/SKILL.md`** — the workflow (Capture
   Intent → Interview → Write SKILL.md → Test → Iterate). Follow it.
2. **`standards/skill-authoring.md`** — the local rules. Read it first.

Repo-specific constraints to enforce:

- The skill folder lives at `skills/<domain>/<name>/`. Domains in use:
  `research/{general,physics-ml,healthcare-tech,data-science}`,
  `content/{substack,anxious-nomad,community}`, `coding`, `business`,
  `productivity`. Anything outside this list requires a new ADR in
  `product/decisions.md`.
- Top-level frontmatter is restricted to `name`, `description`,
  `license`, `allowed-tools`, `metadata`.
- Custom fields go under `metadata`: `status` (stub|authored), `domain`,
  `mode` (local|remote), `mcp-server`, `external-apis`, `outputs`.
- No `README.md` inside the skill folder. Long docs go in `references/`.
- Body ≤500 lines.
- After writing, run `node dashboard/scripts/validate-skills.mjs`.

If the skill replaces a stub already on disk, preserve the existing
folder path and update `metadata.status` to `authored` once tested.
