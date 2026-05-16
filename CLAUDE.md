# CLAUDE.md

Guidance for Claude Code in this repo.

## What this repo is

"Agentic OS": a personal command center delegating recurring research, content, coding, business, and productivity work to Claude Code. Four layers (spec, skills, memory, observability), each enforced by validators.

## Commands

All JS commands run from `dashboard/` (no top-level `package.json`):

```bash
npm run dev                    # Next.js dev at http://localhost:3000
npm run build                  # Production build
npm run lint                   # ESLint via next lint
npm run validate:skills        # run before committing any SKILL.md
npm run validate:automations   # run before committing any automation
```

## Repo layers

- **`product/`, `standards/`, `instructions/`, `specs/`** — spec layer. Read before changing skills, automations, or dashboard.
- **`skills/`** — one folder per skill with a `SKILL.md`. No `README.md` inside skill folders.
- **`skills/_meta/`** — framework-level meta-skills (`skill-creator`, `karpathy-guidelines`, `executing-plans`, `writing-plans`, `verification-before-completion`). Apply on any task.
- **`automations/local/`** — shell scripts, laptop-only, no cron. **`automations/remote/`** — markdown specs for the scheduled task runner.
- **`vault/`** — Obsidian vault (memory). See `vault/CLAUDE.md` for conventions.
- **`dashboard/`** — Next.js 15 + shadcn/ui. SQLite at `.agentic-os/state.db`.

## Dashboard architecture

Spawns `claude -p` headlessly, streams output over SSE. Key files:

- `lib/claude-headless.ts` — spawns `claude -p <prompt> --output-format stream-json --verbose`, parses JSONL events (`assistant`, `tool_use`, `delta`), emits SSE
- `lib/skills-loader.ts` — walks `skills/`, parses `SKILL.md` frontmatter via gray-matter, returns sorted `Skill[]`
- `lib/db.ts` — better-sqlite3 (WAL). Tables: `runs`, `vault_changes`, `schedules`. Migrations on boot.
- `lib/schedules.ts` — parses `automations/remote/*.md` cron for the Forecast card
- `app/api/run/route.ts` — POST endpoint, spawns skill run, streams SSE
- `app/page.tsx` — 3-column grid: 280px skills | 1fr prompt+output | 320px right rail

Layout tokens and component conventions in `standards/dashboard-ui.md`. Use CSS variables from `app/globals.css`; no hardcoded hex.

## Skill authoring

Every `SKILL.md` must pass the validator. Allowed top-level frontmatter keys: `name`, `description`, `license`, `allowed-tools`, `metadata`. Custom fields go under `metadata`.

```yaml
---
name: my-skill                     # must match folder (kebab-case)
description: WHAT + WHEN + trigger phrases. ≤1024 chars, no < or >.
license: MIT
allowed-tools: "Gmail(search:*)"
metadata:
  status: stub                     # stub | authored | blocked
  domain: research
  mode: remote                     # local | remote
  mcp-server: gmail                # or 'none'
  external-apis: []
  outputs: [vault/raw/daily/<YYYY-MM-DD>-name.md]
---
```

- Validator normalizes CRLF→LF, so Windows line endings are fine. Run `npm run validate:skills` before every SKILL.md commit.
- Folder: `skills/<domain>/<name>/`. Optional subfolders: `scripts/`, `references/`, `assets/`. Body ≤500 lines.
- Centralized service references live in `references/services/` (not per-skill).
- New-skill flow: `/new-skill` → edit → `npm run validate:skills` → flip status to `authored`.

## Automation authoring

- **Local** (`automations/local/<skill-slug>.sh`): plain shell, `set -euo pipefail`, resolves repo root via `dirname`, invokes one skill. No cron.
- **Remote** (`automations/remote/<skill-slug>-<cadence>.md`): YAML frontmatter with `schedule` (cron), `skill`, `inputs`. Document the failure mode. Run `npm run validate:automations` after adding.

## Workflow

1. Identify which layer the task touches.
2. Read the relevant `instructions/*.md` (`add-skill.md`, `add-automation.md`, `add-dashboard-card.md`, `promote-raw-to-wiki.md`).
3. New skill → `/new-skill`.
4. Code changes → follow karpathy-guidelines (surface assumptions, surgical edits, minimum code).
5. Run the relevant validator before committing.

## Code conventions

From `standards/code-style.md`:
- TypeScript strict, named exports, type-only imports, kebab-case filenames
- React Server Components by default; `"use client"` only when needed; Server Actions for mutations
- Prepared statements only for SQL; no raw string interpolation
- Catch errors at system boundaries; throw internally
