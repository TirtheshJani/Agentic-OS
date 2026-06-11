# Codex CLI Integration

Claude Control Center includes a dedicated section for [Codex CLI](https://github.com/openai/codex) sessions, complementing its Claude Code focus with visibility into Codex-powered workflows.

## Prerequisites

Set `CODEX_DIR` in `backend/.env` to your Codex data directory (default: `~/.codex`). The Docker setup mounts `~/.codex` automatically.

```sh
CODEX_DIR=~/.codex
```

## Sessions (`/codex-sessions`)

The Sessions page lists all Codex CLI sessions found in `~/.codex/`. Each session shows:

- Session title (inferred from the first message or filename)
- Creation date
- Status
- User note (editable)

### Filtering and sorting

- **Search** — filter sessions by title keyword
- **Sort** — by date (newest first) or by name (alphabetical)
- **Filter** — by status

### Session detail (`/codex-sessions/:sessionId`)

The detail page shows the full session content plus metadata. You can add or edit a note on any session — notes are stored in a sidecar metadata file alongside the session data and are never written into the session file itself.

### Session notes

Notes are a lightweight way to annotate sessions for future reference: what was accomplished, what to revisit, or links to related PRs. Notes are persisted in `backend/data/codex_cli_sessions.json`.

## Skills (`/codex-skills`)

Lists skills available to Codex CLI from `~/.codex/skills/`.

## Settings (`/codex-settings`)

Reads and displays Codex CLI settings from `~/.codex/settings.json`. Read-only; edit the file directly or through the Codex CLI itself.

## Memory (`/codex-memory`)

Lists Codex CLI memory entries from `~/.codex/memory/`. Read-only view.

## Analytics (`/codex-analytics`)

Usage statistics for Codex CLI sessions: session count over time, model distribution, and activity heatmap.

## Codex usage tracker

Separate from the Codex CLI section, the **Codex** page (`/codex`) tracks Codex tool invocations that appear inside Claude Code sessions — i.e., when Claude Code's `codex:rescue` or similar skills call Codex. This is automatically detected from the JSONL conversation files and cached in `backend/data/codex_usages.json`.
