# Agent authoring standard

Agent profiles live in `agents/<slug>.md`: YAML frontmatter plus a
`# System Prompt` body. This standard gives them the same kind of contract
skills and automations already have (`standards/skill-authoring.md`,
`standards/automation-authoring.md`). It implements ADR-005 (frontmatter spec
keys) and ADR-007 (description-based routing).

The validator (`dashboard/scripts/validate-agents.mjs`,
`npm run validate:agents`) enforces the mechanical parts. Run it before
committing any `agents/*.md`.

## 1. Folder rules

- **File name:** `agents/<slug>.md`, kebab-case, `<slug>` matches the
  `slug` frontmatter field (`research-lead` -> `agents/research-lead.md`).
- **One agent per file.** No `README.md`, `CLAUDE.md`, or other stray files
  alongside the profiles.
- **Archived agents** move to `agents/_archive/`; prompt fragments shared
  across agents live in `agents/_prompts/`. Neither is validated.

## 2. Frontmatter — only these keys

| Key | Required | Notes |
|---|---|---|
| `name` | yes | Human-readable handle. Kebab-case in practice; matches `slug`. |
| `slug` | yes | Kebab-case (`^[a-z0-9][a-z0-9-]*$`). **Must match the filename.** |
| `description` | yes | The routing signal (see §3). Must name the agent's domain vocabulary. No `<` or `>`; <=1024 chars. |
| `created` | yes | `YYYY-MM-DD`. Unquoted dates are coerced to strings on parse. |
| `runtime` | no | CLI runtime; defaults to `claude-code`. Also `gemini-cli`, `antigravity-cli`. |
| `model` | no | Passed to the runtime CLI (`opus`, `gemini-2.5-flash`). Absent = runtime default. |
| `allowed-tools` | no | List of tool names the agent may call. Defaults to `[]`. |
| `skills` | no | List of coarse capability tags (`research`, `coding`, `writing`...). Matched against project `capabilities` for eligibility (`lib/eligibleAgents.ts`) and tokenized for routing — **not** references to a `skills/**/SKILL.md` name. Defaults to `[]`. |

Anything else at the top level is **invalid** and the validator rejects it.
The keys mirror `AgentFrontmatterSchema` in `dashboard/lib/schemas.ts`; keep
the two in step.

## 3. Description field — the routing signal (the important one)

`description` is not just prose. The deterministic auto-router (ADR-007,
`lib/orchestrator/router.ts`) tokenizes an incoming issue and scores each
candidate agent's `description` against it (a description-token hit weighs 3,
a skill-name hit weighs 1). So the vocabulary in `description` decides where
skill-free prompts land.

**Name the domain, not the mechanism.**

```yaml
# Good — names the domain (health-watcher)
description: >-
  Healthcare-tech research. Owns prompts about FDA, MHRA, EMA, NIH, ONC,
  HIPAA, FHIR, HL7, clinical trials, PubMed, biomedical ML, RAG over medical
  literature, device clearances, regulatory standards.

# Bad — describes how it routes, names no domain (old research-lead)
description: >-
  Routes research tasks to the right teammate based on skill overlap. Lead of
  the research department.
```

A description that lists concrete domain terms a user would actually type
(agencies, formats, file types, named techniques) routes well. One built from
routing boilerplate ("routes tasks to the right teammate", "lead of the X
department") does not, and the validator warns on it.

**Lead vs member nuance.** `routeIssue` only scores non-lead members; a
`-lead` agent is a department inbox that the auto-router immediately re-routes
to a member. A lead's `description` therefore does not change routing
outcomes today, but it must still name the department's domain: it documents
the department's scope and keeps the routing-health check honest as members
are added.

## 4. Body — `# System Prompt`

The body is the agent's system prompt. Lead with the `# System Prompt`
heading, then cover, by markdown section or plain paragraphs:

- **Role** — who the agent is and which department or task it owns.
- **Operating procedure** — the steps it runs per invocation (read the task,
  act, append a thread note, report back).
- **Available teammates or tools** — for leads, the members it can delegate
  to; for members, the skills it is allowed to call.
- **Stop condition** — when to stop, and what not to do (do not invent
  teammates, do not reassign to the user without instruction, etc.).

Write plain markdown. **No rigid XML templates** — they tend to pull
vocabulary out of `description` (where the router reads it) into a body the
matcher never sees, which is exactly the ADR-007 failure mode this standard
guards against.

## 5. Handoff (forward reference)

Validation contracts and structured handoffs are specified in
`specs/0029-validation-contracts-and-handoffs.md`. When that lands, agents
will write a `HANDOFF.md` to their worktree (completed work, remaining work,
commands run with exit codes, issues discovered, and a per-assertion
self-assessment), and acceptance assertions will be phrased as a checklist
under an `## Acceptance contract` issue section. Until then this section is a
placeholder; do not hand-author `HANDOFF.md`.

## 6. Author checklist (before committing)

- [ ] Filename `agents/<slug>.md`, kebab-case, matches `slug`.
- [ ] Frontmatter has only the keys in §2; `name`, `slug`, `description`,
  `created` all present.
- [ ] `description` names the agent's domain vocabulary, not routing
  boilerplate; <=1024 chars, no `<` or `>`.
- [ ] `skills` is a list of kebab-case capability tags.
- [ ] Body opens with `# System Prompt` and states role, procedure, teammates
  or tools, and a stop condition.
- [ ] `npm run validate:agents` passes with no warnings.

The validator enforces the frontmatter items mechanically and warns on a
vocab-less `description`. CI runs it once the lint/test/build
workflow lands (`specs/0025-repo-hygiene-and-ci.md`).
