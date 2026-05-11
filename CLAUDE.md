# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

An "Agentic OS": a personal command center for delegating recurring research, content, coding, business, and productivity work to Claude Code. Four layers — spec, skills, memory, observability — each with strict conventions enforced by validators.

## Commands

All JS commands run from the `dashboard/` directory:

```bash
# Development
cd dashboard && npm run dev          # Next.js dev server at http://localhost:3000
cd dashboard && npm run build        # Production build
cd dashboard && npm run lint         # ESLint via next lint

# Validation (run before committing any SKILL.md or automation)
cd dashboard && npm run validate:skills        # node scripts/validate-skills.mjs
cd dashboard && npm run validate:automations   # node scripts/validate-automations.mjs
```

There is no top-level `package.json`. All JS dependencies are under `dashboard/`.

## Repo layers

- **`product/`, `standards/`, `instructions/`, `specs/`** — spec layer. Read before changing skills, automations, or the dashboard.
- **`skills/`** — one folder per skill, each with a `SKILL.md`. Never put `README.md` inside a skill folder.
- **`skills/_meta/`** — meta-process skills (framework-level): `skill-creator/`, `karpathy-guidelines/`, `executing-plans/`, `writing-plans/`, `verification-before-completion/`. Apply these on any task before/during/after authoring domain skills.
- **`automations/local/`** — shell scripts, no cron, laptop-only. **`automations/remote/`** — markdown specs for Claude Code's scheduled task runner.
- **`vault/`** — Obsidian vault (memory layer). See `vault/CLAUDE.md` for folder conventions.
- **`dashboard/`** — Next.js 15 + shadcn/ui command center. SQLite at `.agentic-os/state.db`.

## Dashboard architecture

The dashboard spawns `claude -p` headlessly and streams output over SSE. Key files:

- `dashboard/lib/claude-headless.ts` — spawns `claude -p <prompt> --output-format stream-json --verbose`, parses JSONL events (`assistant`, `tool_use`, `delta`), emits to SSE
- `dashboard/lib/skills-loader.ts` — walks `skills/` tree, parses `SKILL.md` frontmatter via gray-matter, returns sorted `Skill[]`
- `dashboard/lib/db.ts` — better-sqlite3 wrapper (WAL mode). Three tables: `runs`, `vault_changes`, `schedules`. Migrations on boot.
- `dashboard/lib/schedules.ts` — parses `automations/remote/*.md` cron expressions for the Forecast card
- `dashboard/app/api/run/route.ts` — POST endpoint that spawns a skill run and streams SSE back
- `dashboard/app/page.tsx` — 3-column grid: 280px skills rail | 1fr prompt+output | 320px right rail

Layout tokens and component conventions are in `standards/dashboard-ui.md`. Use CSS variables from `app/globals.css`; no hardcoded hex colors.

## Skill authoring

Every `SKILL.md` must pass the validator before committing. Allowed frontmatter top-level keys: `name`, `description`, `license`, `allowed-tools`, `metadata`. Everything custom goes under `metadata`.

```yaml
---
name: my-skill                     # must match folder name (kebab-case)
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

**Validator note:** The validator (`validate-skills.mjs`) normalizes CRLF to LF before parsing — Windows line endings are handled correctly. Run `npm run validate:skills` (from `dashboard/`) before every commit touching a `SKILL.md`.

Folder: `skills/<domain>/<name>/`. Optional subfolders: `scripts/`, `references/`, `assets/`. Body ≤500 lines. Centralized service references live in `references/services/` (not per-skill).

Workflow for new skills: `/new-skill` → edit → `npm run validate:skills` → flip status to `authored`.

## Automation authoring

**Local** (`automations/local/<skill-slug>.sh`): plain shell, `set -euo pipefail`, resolves repo root via `dirname`, invokes one skill. No cron.

**Remote** (`automations/remote/<skill-slug>-<cadence>.md`): YAML frontmatter with `schedule` (cron), `skill`, `inputs`. Document the failure mode. Run `npm run validate:automations` after adding.

## Workflow when asked to do work

1. Identify which layer the task touches.
2. Read the relevant `instructions/*.md` (`add-skill.md`, `add-automation.md`, `add-dashboard-card.md`, `promote-raw-to-wiki.md`).
3. For new skills, use `/new-skill`.
4. For code changes, follow karpathy-guidelines: surface assumptions, surgical edits, minimum code.
5. Run the relevant validator before committing.

## Code conventions

From `standards/code-style.md`:
- TypeScript strict mode, named exports, type-only imports, kebab-case filenames
- React Server Components by default; `"use client"` only when necessary; Server Actions for mutations
- Prepared statements only for SQL; no raw string interpolation
- Catch errors at system boundaries; throw internally
