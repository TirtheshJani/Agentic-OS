---
description: Author a new skill via the vendored Anthropic skill-creator.
---

Read `prompts/skill-creator.md` and `standards/skill-authoring.md`, then
follow the workflow in `skills/_meta/skill-creator/SKILL.md`.

Repo-specific constraints:

- New skills go under `skills/<domain>/<name>/` where domain is one of:
  `research/{general,physics-ml,healthcare-tech,data-science}`,
  `content/{substack,anxious-nomad,community}`, `coding`, `business`,
  `productivity`. Anything else needs a new ADR in `product/decisions.md`.
- Top-level frontmatter: only `name`, `description`, `license`,
  `allowed-tools`, `metadata`.
- Custom fields under `metadata`: `status` (stub|authored), `domain`,
  `mode`, `mcp-server`, `external-apis`, `outputs`.
- No `README.md` inside the skill folder.

After writing:

```bash
node dashboard/scripts/validate-skills.mjs
```

Must exit 0 before flipping `metadata.status` to `authored`.
