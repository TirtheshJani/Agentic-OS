# Add an automation

Automations wrap skills with timing or invocation context.

## Local (laptop-only)

1. Decide which skill the automation invokes.
2. Create `automations/local/<skill-slug>.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   cd "$(dirname "$0")/../.."
   exec claude -p "Use the <skill-slug> skill"
   ```
3. `chmod +x` it.
4. (Optional) link from the dashboard by adding a "Quick run" button —
   see `instructions/add-dashboard-card.md`.

## Remote (Claude Code scheduled task)

1. Pick a cadence and write a cron expression (24h, repo-local TZ).
2. Create `automations/remote/<skill-slug>-<cadence>.md`:
   ```md
   ---
   schedule: "0 9 * * 1-5"
   skill: morning-trend-scan
   inputs: ["today"]
   ---
   # What this does
   ...
   # Failure mode
   Idempotent. Safe to retry.
   ```
3. Register the spec with Claude Code's scheduled-task runner. (Out of
   scope for the bootstrap; see `product/roadmap.md` Phase 4.)
4. The dashboard's forecast card reads these specs to display next-run
   times. No code change needed.

## Naming

Local: `<skill-slug>.sh`. Remote: `<skill-slug>-<cadence>.md`. One file
per (skill, cadence) pair.
