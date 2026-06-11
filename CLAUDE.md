# CLAUDE.md

Guidance for Claude Code in this repo.

## What this repo is

"Agentic OS": a personal command center delegating recurring research, content, coding, business, and productivity work to autonomous agents. Layers: spec, skills, agents, memory (vault + SQLite knowledge index), and the dashboard that runs it all.

## Commands

All JS commands run from `dashboard/` (no top-level `package.json`):

```bash
npm run dev                    # custom server (tsx watch server.ts) at http://localhost:3000
npm test                       # vitest suite
npm run validate:skills        # run before committing any SKILL.md
npm run validate:automations   # run before committing any automation
npm run build                  # next build (server still starts via tsx server.ts)
```

Desktop-style launch: `bin/launch-dashboard.ps1` (and `bin/install-shortcut.ps1` for the Start Menu entry). The dashboard is an installable PWA.

## Repo layers

- **`product/`, `standards/`, `instructions/`, `specs/`** — spec layer. Read before changing skills, automations, or dashboard. Current architecture: specs 0007-0011; decisions in `product/decisions.md`.
- **`skills/`** — one folder per skill with a `SKILL.md`. No `README.md` inside skill folders.
- **`agents/`** — one `<slug>.md` per agent (frontmatter: name, slug, description, runtime, skills, allowed-tools + `# System Prompt` body). Managed from the `/agents` view; archived agents move to `agents/_archive/`.
- **`automations/local/`** — shell scripts, laptop-only. **`automations/remote/`** — markdown cron specs; with a `project:` key the in-dashboard scheduler files them as queued issues (spec 0009).
- **`vault/`** — Obsidian vault (memory). See `vault/CLAUDE.md`. Indexed into SQLite (notes, wikilinks, tags, FTS) for `/graph`, `/api/search`, and the inbox.
- **`dashboard/`** — Next.js 15 + React 19 + Tailwind, custom `server.ts` run via tsx. SQLite at `.agentic-os/state.db` (WAL; tables: issues, runs, hook_events, settings_kv, schedule_state, notes, note_links, notes_fts). Migrations apply on boot in `lib/db.ts`.

## Dashboard architecture

Agent runs are interactive CLI sessions in PTYs (node-pty), one git worktree per issue, streamed to xterm.js in the browser over a WebSocket. Claude Code runs bill the operator's Max plan via the logged-in CLI; Gemini CLI runs use the Google AI Pro account. Headless `claude -p` is reserved for tiny one-shot calls (agent drafting) because subscription headless use draws from the monthly Agent SDK credit pool.

Key paths (all under `dashboard/`):

- `lib/runtime/` — Runtime contract with capability flags (`types.ts`), `claude-code.ts` and `gemini-cli.ts` implementations, registry, liveRuns (globalThis-shared), concurrency caps, hook installer
- `lib/startRun.ts` — the run pipeline (resolve, capacity, worktree, MCP injection, spawn, exit persistence); `POST /api/runs` is a thin wrapper
- `lib/orchestrator/` — deterministic issue router (ADR-007 scoring) + auto-router; `lib/scheduler.ts` — 60s cron tick over `automations/remote`
- `lib/settings.ts` — file-backed settings incl. the `autonomy` kill switch (off by default)
- `lib/vault/indexer.ts` — vault index full-rebuilds (boot + chokidar debounce)
- `lib/mcp.ts` + `lib/connections.ts` — MCP templates in gitignored `.agentic-os/mcp/`, injected into worktrees per `PROJECT.md` `mcp-servers:`; connector status detectors
- `server.ts` — HTTP + WebSocket (`/api/runtime/socket/:runId`) + warm-up request that boots `ensureServerBooted` (watcher, runtimes, router, scheduler, vault index)
- `lib/stream.ts` — in-process event bus (globalThis-shared across the tsx/Next module graphs) feeding `GET /api/stream` SSE
- Views: `/` projects, `/issues` global kanban, `/agents` creator, `/skills`, `/graph`, `/inbox`, `/runtimes`, `/connections`, `/settings`

UI conventions in `standards/dashboard-ui.md`. No auth layer: localhost, single operator.

Gotchas that have bitten before: xterm and sigma must be imported dynamically inside `useEffect` (module scope breaks SSR); anything stateful shared between `server.ts` and API routes needs the `globalThis Symbol.for` hoist (see `liveRuns.ts`); ConPTY needs Enter sent as a separate delayed write after a prompt body.

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
- **Remote** (`automations/remote/<skill-slug>-<cadence>.md`): YAML frontmatter with `schedule` (cron), `skill`, `inputs`, optional `project` (vault project slug; required for the in-dashboard scheduler to file issues) and `agent` (pre-assign; otherwise the auto-router picks). Document the failure mode. Run `npm run validate:automations` after adding.

## Workflow

1. Identify which layer the task touches.
2. Read the relevant `instructions/*.md` and the governing spec under `specs/`.
3. New skill → `/new-skill`. New agent → the `/agents` view (or hand-write `agents/<slug>.md`).
4. Code changes → follow karpathy-guidelines (surface assumptions, surgical edits, minimum code).
5. Run `npm test` plus the relevant validator before committing.

## Code conventions

From `standards/code-style.md`:
- TypeScript strict, named exports, type-only imports, kebab-case filenames
- React Server Components by default; `"use client"` only when needed
- Prepared statements only for SQL; no raw string interpolation
- Catch errors at system boundaries; throw internally
