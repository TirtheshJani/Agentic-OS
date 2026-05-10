# Spec 0001 — Initial bootstrap

**Status:** in progress (this PR is the implementation).
**Owner:** Tirthesh.
**Date:** 2026-05-10.
**Branch:** `claude/init-project-setup-BNxJv`.

## Why

The repo is empty. We want a working Claude Code Agentic OS that:

- delegates recurring work to named skills,
- writes outputs to a durable Obsidian vault,
- exposes a local dashboard for one-click execution and run history.

Without this bootstrap, every interaction with Claude Code starts from
scratch. With it, ~25 skills are pre-scaffolded and a dashboard surfaces
them as buttons.

## Scope

Layers 0–3 of the design (`plan.md`):

- **Layer 0 — Spec/standards.** `product/`, `standards/`, `instructions/`,
  `specs/` (this file).
- **Layer 1 — Architecture.** `template/`, `skills/_meta/` (vendored),
  `skills/<domain>/`, `automations/`, `prompts/`, `.claude/commands/`.
- **Layer 2 — Memory.** `vault/` tree + `vault/CLAUDE.md`.
- **Layer 3 — Observability.** `dashboard/` (Next.js 15 + Tailwind +
  shadcn + SQLite).

## Out of scope

- Authoring skill bodies for the ~25 stubs (Phase 2 of the roadmap).
- Authentication on the dashboard.
- Registering remote scheduled tasks (Phase 4).
- Vector DB or RAG memory.
- Any deployment beyond `localhost:3000`.

## Acceptance criteria

1. `tree -L 3 -I node_modules .` matches the layout in `plan.md`.
2. `node dashboard/scripts/validate-skills.mjs` exits 0.
3. `cd dashboard && npm run build` exits 0.
4. `npm run dev` serves at `http://localhost:3000` and shows ~25 skill
   buttons grouped by 5 domains.
5. Clicking **Run** on any authored skill executes via `claude -p`,
   streams events back, and inserts a row into `runs`.
6. Touching a file under `vault/` inserts a row into `vault_changes`
   within 1 second.
7. `skills/_meta/skill-creator/SKILL.md` and
   `skills/_meta/karpathy-guidelines/SKILL.md` exist verbatim from
   upstream, with provenance in `product/decisions.md`.

## Dependencies

- `claude` CLI on PATH at runtime (already present at
  `/opt/node22/bin/claude`).
- Node 22 LTS (already present).
- Network access to `github.com` at bootstrap time (one-shot, for
  vendoring).

## Risks

- **Dashboard `claude -p` integration.** Stream-JSON event shape may
  differ in this Claude Code version; mitigated by best-effort parsing
  and a passthrough mode.
- **better-sqlite3 native build.** May need `python3` + build tools.
  Fallback: switch to `sql.js` if native build fails.
