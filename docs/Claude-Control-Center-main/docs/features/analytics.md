# Analytics & Codeburn

The Analytics page surfaces token usage, activity patterns, model breakdowns, and cost estimates across all your Claude Code sessions.

## How it works

On startup, a background thread scans all JSONL files under `~/.claude/projects/` and writes a summary cache to `backend/data/analytics_stats.json`. The scan extracts token counts, model names, tool calls, plan-mode detection signals, and timestamps from each session.

The cache is updated automatically when new sessions are detected. You can also trigger a manual rescan from the Analytics page.

## Stats tab

- **Total tokens** — input, output, cache read, and cache write tokens across the selected time range.
- **Daily activity** — bar chart of message count per day.
- **Model breakdown** — donut chart showing which Claude models were used.
- **Project breakdown** — token usage per project.
- **Plan-mode detection** — sessions where Claude appears to have used structured planning (detected by presence of plan-file writes and task-file reads).
- **Verification rate** — proportion of sessions where Claude ran tests or build commands (pytest, npm test, tsc, etc.) — a signal of thoroughness.

## Codeburn tab

Codeburn estimates the cost of your sessions in USD and CAD.

### Pricing model

Costs are calculated from the token counts in each session combined with a pricing table keyed by model family:

| Model | Input ($/1M) | Output ($/1M) | Cache read ($/1M) | Cache write ($/1M) |
|---|---|---|---|---|
| claude-opus-4 | $15.00 | $75.00 | $1.50 | $18.75 |
| claude-sonnet-4 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-haiku-4 | $0.80 | $4.00 | $0.08 | $1.00 |
| claude-3-5-sonnet | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-3-5-haiku | $0.80 | $4.00 | $0.08 | $1.00 |
| claude-3-opus | $15.00 | $75.00 | $1.50 | $18.75 |
| claude-3-haiku | $0.25 | $1.25 | $0.03 | $0.30 |

### Task categories

Each session is classified into one of the following categories based on the tools used and the content of user messages:

| Category | Description |
|---|---|
| Coding | Writing new code |
| Debugging | Fixing bugs and errors |
| Refactoring | Restructuring existing code |
| Feature Dev | Implementing a new feature |
| Testing | Writing or running tests |
| Git | Git operations |
| Build / Deploy | Build, CI, or deployment tasks |
| Exploration | Reading and understanding code |
| Planning | High-level planning sessions |
| Delegation | Spawning subagents |
| Brainstorming | Open-ended ideation |
| Conversation | General discussion |
| General | Uncategorised |

### Exchange rate

The USD → CAD exchange rate is fetched from the [Frankfurter API](https://www.frankfurter.app/) and cached for 24 hours. If the fetch fails, the last known rate is used.

## Time range filter

The `days` filter accepts: **7 days**, **30 days**, **90 days**, or **All time**. It applies to both the Stats and Codeburn tabs.

## Triggering a rescan

Click **Rescan** on the Analytics page to force a fresh parse of all JSONL files. This is useful if sessions were added while the dashboard was closed.

Alternatively, call `POST /api/analytics/scan` directly.
