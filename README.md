# Agentic-OS

A personal "Agentic OS" built on top of Claude Code: a single repo that holds
your skills, automations, memory, and a local dashboard for delegating
recurring work.

> **Status:** scaffolding bootstrap. ~25 domain skills exist as spec-compliant
> stubs; author them interactively via `/new-skill`. See `plan.md` for the
> full design.

## Layers

1. **Spec layer** — `product/`, `standards/`, `instructions/`, `specs/`
   (agent-os conventions for *how* we build).
2. **Architecture layer** — `skills/` (Anthropic Skills spec) and
   `automations/`.
3. **Memory layer** — `vault/` (Obsidian: `raw/` → `wiki/` → `outputs/`).
4. **Observability layer** — `dashboard/` (Next.js 15 + Tailwind + shadcn/ui +
   SQLite). Spawns `claude -p` headless and streams output back over SSE.

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
