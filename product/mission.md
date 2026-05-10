# Mission

## What this is

Agentic-OS is a personal command center built on Claude Code. It turns the
"chat with an LLM" interaction into a **delegate to skills, watch them run,
own the output** workflow.

## Who it's for

A single operator with recurring research, content, coding, and business
work who wants Claude Code to:

- run named, repeatable tasks (skills) across multiple domains,
- write durable outputs into a memory layer (Obsidian vault),
- be observable through a local dashboard rather than a chat scrollback.

## The three gaps it closes

1. **Memory.** Chat context dies between sessions. Skills + the vault give
   work a durable home (`raw/` → `wiki/` → `outputs/`).
2. **Consistency.** The same task should run the same way every time. Skills
   codify the *what* and *how*; standards codify the *style*.
3. **Access.** "Open a terminal, type a long prompt" is friction. The
   dashboard surfaces every skill as a one-click run with streaming output
   and a queryable history.

## Success criteria

- ≥25 spec-compliant skill stubs scaffolded; ≥1 fully authored end-to-end.
- Dashboard runs `claude -p` headless and streams events back over SSE.
- SQLite captures every run; recent runs and vault changes appear within 1s.
- A new skill can be authored with `/new-skill` (delegating to vendored
  Anthropic skill-creator) without re-deriving conventions.

## Non-goals

- Multi-user or team deployments.
- Authenticated/exposed dashboard.
- Vector DB or RAG memory (filesystem + git is the memory).
- 24/7 always-on host (laptop-only; remote work goes to Claude Code
  scheduled tasks).
