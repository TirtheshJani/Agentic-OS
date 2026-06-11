# Advisor Tracker

The Advisor page (`/advisor`) tracks all calls to the `advisor()` tool across your Claude Code sessions.

## What is the advisor tool?

The `advisor` tool is a Claude Code feature that lets the active AI model consult a stronger reviewer model by forwarding the full conversation context. It is used in complex tasks where a second opinion from a more capable model improves quality.

When Claude calls `advisor()`, it appears as a tool use event in the session JSONL file. The advisor tracker scans all JSONL files and counts these events.

## How it works

On startup, a background thread scans all `~/.claude/projects/` JSONL files for tool use events where the tool name is `advisor`. Results are aggregated and cached in `backend/data/advisor_usages.json`.

The tracker stores:
- Total advisor calls across all projects
- Per-project call counts
- Per-session call counts
- Timestamps of recent calls

## What you see

The Advisor page shows:

- **Total calls** — lifetime count across all scanned sessions
- **By project** — which projects have used the advisor most
- **Recent activity** — a timeline of recent calls with session links

## Triggering a rescan

Call `POST /api/advisor/scan` or use the Rescan button on the Advisor page to force a fresh scan. This is needed if new sessions have been added since the last startup.

## Use cases

- Understand how often your Claude Code workflows invoke the advisor
- Identify projects where complex tasks require frequent second opinions
- Audit advisor usage when debugging unexpected costs (advisor calls consume additional tokens)
