# Spec 0008: Agent Creator

> **Status:** Shipped with the command-center build (June 2026). Implements
> the AgentProfileForm idea from spec 0003 (Phase 4) on the current
> dashboard, plus an AI-draft assist.

## Goal

Create, edit, and archive agent profiles from the dashboard without
hand-editing markdown, while keeping `agents/<slug>.md` files as the
canonical, git-reviewable source of truth. No database table: the files ARE
the registry, parsed by `lib/agents.ts` exactly as before.

## Behavior

- `/agents` lists every profile as a card (name, RuntimeBadge, description,
  skills, allowed-tools) with Edit, plus a "+ New Agent" button.
- `components/agents/AgentEditor.tsx` is a drawer form: name, slug
  (immutable after creation), description, runtime (dropdown from
  `/api/runtimes`, unavailable runtimes disabled), skills (checkbox list
  from `/api/skills`), allowed-tools (comma-separated), system prompt.
- "Draft with AI": a one-line description POSTs to `/api/agents/draft`,
  which makes exactly ONE headless `claude -p --output-format json` call
  and returns `{ name, slug, description, skills, allowedTools,
  systemPrompt }`. Hallucinated skills/tools are filtered against the known
  sets rather than failing. The endpoint never loops or retries: headless
  subscription calls draw from the monthly Agent SDK credit pool (policy
  effective 2026-06-15).
- Archive moves the file to `agents/_archive/<slug>.md`. `listAgents` only
  reads root-level files, so archived agents disappear from every picker
  while staying recoverable.

## API

- `POST /api/agents` create; `GET/PATCH/DELETE /api/agents/[slug]`.
- `POST /api/agents/draft` with `{ description }`.
- `GET /api/skills` lists SKILL.md frontmatter (also feeds the skills view).
- SSE refresh is free: the existing chokidar watcher on `agents/` publishes
  `agent.changed` whenever a file is written.

## Validation (`lib/agentMutations.ts`)

- slug matches the shared `slugRegex`; unique on create; immutable on
  update (archive and recreate to rename).
- runtime must be registered in the runtime registry.
- every skill must resolve against `skills/` by skill NAME or DOMAIN
  (existing profiles like research-lead reference whole domains).
- allowed-tools entries non-empty; system prompt required.
- `description` was added to `AgentFrontmatterSchema`: it was always
  present in the files and is the routing signal per ADR-007, but the
  schema previously stripped it.

## Out of scope

Renaming slugs in place, multi-file agent definitions, syncing to
`.claude/agents/` subagent format (the dashboard spawns full CLI sessions,
not Claude Code subagents).
