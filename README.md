# Agentic-OS

A personal "Agentic OS" built on top of Claude Code: a single repo that holds
your agents, skills, automations, memory, and a local command center for
delegating recurring work to autonomous agents.

> **Status:** command center shipped (June 2026, specs 0007-0011): kanban
> agent assignment, dual runtimes (Claude Code on the Max plan + Gemini CLI
> on Google AI Pro), agent creator with AI draft, autonomy with a kill
> switch, vault knowledge graph, connections hub.

## Layers

1. **Spec layer** — `product/`, `standards/`, `instructions/`, `specs/`
   (agent-os conventions for *how* we build).
2. **Architecture layer** — `agents/` (one markdown profile per agent),
   `skills/` (Anthropic Skills spec), and `automations/`.
3. **Memory layer** — `vault/` (Obsidian: `raw/` → `wiki/` → `outputs/`),
   indexed into SQLite for graph view and full-text search.
4. **Command center** — `dashboard/` (Next.js 15 + React 19 + SQLite +
   node-pty). Issues move across a kanban; agents run as real CLI sessions
   in per-issue git worktrees, streamed to in-browser terminals; an
   orchestrator routes queued work when autonomy is on.

## Quickstart

```bash
# 1. Skills + memory are filesystem-only — nothing to install for those.

# 2. Run the dashboard locally.
cd dashboard
npm install
npm run dev          # http://localhost:3000

# 3. Author a stub skill.
#    From any Claude Code session in this repo:
#      /new-skill
#    This delegates to skills/_meta/skill-creator (Anthropic's production
#    skill-creator) and writes the result under skills/<domain>/<name>/.
```

## Launch like a desktop app

```powershell
# One-time: create the Start Menu entry "Agentic OS".
powershell -ExecutionPolicy Bypass -File bin/install-shortcut.ps1

# Every launch after that: click "Agentic OS" in the Start Menu.
# It installs deps on first run, starts (or reuses) the server, and opens
# an app-frame browser window. Useful switches:
bin/launch-dashboard.ps1 -Stop    # stop the background server
bin/launch-dashboard.ps1 -Prod    # run the production build instead of dev
```

The dashboard is also an installable PWA: open http://localhost:3000 in
Edge/Chrome and use the install-app affordance in the address bar.

Runtimes: agent runs spawn your locally installed CLIs, so log each one in
once manually first (`claude` for the Max plan, `gemini` for Google AI Pro
after `npm i -g @google/gemini-cli`). The /runtimes view shows status.

## Vendored reference skills

- `skills/_meta/skill-creator/` — from
  [`anthropics/skills`](https://github.com/anthropics/skills). Use when
  authoring any new skill.
- `skills/_meta/karpathy-guidelines/` — from
  [`forrestchang/andrej-karpathy-skills`](https://github.com/forrestchang/andrej-karpathy-skills).
  Behavioral guidelines for code-writing tasks (Think Before Coding /
  Simplicity First / Surgical Changes / Goal-Driven Execution).

## Conventions

- `SKILL.md` files comply with the official
  [Anthropic Skills spec](https://github.com/anthropics/skills): top-level
  frontmatter limited to `name`, `description`, `license`, `allowed-tools`,
  `metadata`. Custom fields go under `metadata`.
- No `README.md` inside a skill folder — per-skill human notes live in
  `references/`.
- Dashboard binds to `127.0.0.1` only. Do not expose without auth.

## License

MIT — see `LICENSE`.
