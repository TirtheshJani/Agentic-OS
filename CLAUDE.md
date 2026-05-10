# Agentic-OS — instructions for Claude Code

This repo is an "Agentic OS": a personal command center for delegating recurring
research, content, coding, business, and productivity work to Claude Code.

When you're working in this repo, follow this map:

## Repo layers

- **`product/`, `standards/`, `instructions/`, `specs/`** — the spec layer
  (agent-os conventions). Long-lived docs about *how we build things here*.
  Read these before changing skills, automations, or the dashboard.
- **`skills/`** — domain skills, one folder per skill, each containing a
  `SKILL.md` (Anthropic Skills spec). Optional `scripts/`, `references/`,
  `assets/` subfolders. **Never put a `README.md` inside a skill folder.**
- **`skills/_meta/`** — vendored cross-cutting skills:
  - `skill-creator/` — Anthropic's production skill-creator. Use this when
    asked to author or refine a skill (do **not** reinvent the workflow).
  - `karpathy-guidelines/` — the four behavioral principles
    (Think Before Coding / Simplicity First / Surgical Changes /
    Goal-Driven Execution). Apply on any code-writing task in this repo.
- **`automations/`** — `local/` (shell scripts you invoke when the laptop is
  open) and `remote/` (markdown specs registered with Claude Code's scheduled
  task runner). No cron — host is laptop-only.
- **`vault/`** — Obsidian vault, the memory layer. Folders: `raw/`, `wiki/`,
  `outputs/`, `projects/`, `archive/`. See `vault/CLAUDE.md` for conventions.
- **`dashboard/`** — Next.js 15 + Tailwind + shadcn/ui command center. Spawns
  `claude -p` headless. Backed by SQLite at `.agentic-os/state.db`.
- **`template/SKILL.md`** — minimal canonical skill stub. Mirror of
  `anthropics/skills/template/SKILL.md`.

## Authoritative references

- Anthropic Skills spec & guide: every `SKILL.md` in this repo must comply.
  Top-level frontmatter is restricted to `name`, `description`, `license`,
  `allowed-tools`, `metadata`. Description must include WHAT + WHEN + trigger
  phrases, ≤1024 chars, no `<` or `>`. Folder names kebab-case. No reserved
  prefixes (`claude`, `anthropic`).
- `standards/skill-authoring.md` — the local standard, which cites the spec.

## Workflow when asked to do work

1. Identify which layer the task touches.
2. Read the relevant `instructions/*.md` (e.g. `add-skill.md`,
   `add-dashboard-card.md`).
3. For new skills, run `/new-skill` (delegates to `skills/_meta/skill-creator`).
4. For code changes, follow `skills/_meta/karpathy-guidelines/`: surface
   assumptions, write minimum code, surgical edits, define success criteria.
5. Run the dashboard validator (`dashboard/scripts/validate-skills.mjs`)
   before committing changes to any `SKILL.md`.
