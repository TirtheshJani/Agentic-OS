# Session History

The History page (`/history`) provides a flat, chronologically ordered log of all your Claude Code activity.

## What is tracked?
The dashboard reads the `history.jsonl` file from `~/.claude/`. This file acts as a high-level audit log for the entire application.

### Log Entries
Each entry in the history log represents a significant event:
- **Session Start**: When a new Claude Code session was initiated.
- **Tool Use**: Summary of key tools invoked during a session.
- **Project Context**: Which project was active during the event.
- **Git Context**: The branch and commit hash at the time of the event.

## Features
- **Project Filtering**: Quickly see the history for a specific repository.
- **Search**: Find past events by project name or tool usage.
- **Deep Linking**: Click on any history entry to jump directly to the full conversation thread in the **Conversations** section.

## Data Source
- **File**: `~/.claude/history.jsonl`
- **Format**: JSON Lines, parsed using the high-performance `orjson` library.
- **Ordering**: The dashboard presents entries in reverse-chronological order (newest first).
