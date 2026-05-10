# Automation authoring standard

Two flavors, two locations:

## Local (`automations/local/*.sh`)

For work that only runs while the laptop is open. Plain shell scripts
that invoke `claude -p`.

```bash
#!/usr/bin/env bash
# automations/local/morning-scan.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
exec claude -p "Use the morning-trend-scan skill"
```

Rules:

- `set -euo pipefail` always.
- Resolve repo root via `dirname` of the script — never assume CWD.
- Invoke a single skill per script. Composition belongs in the skill, not
  the wrapper.
- Make scripts executable: `chmod +x`.

## Remote (`automations/remote/*.md`)

Markdown specs registered with Claude Code's scheduled-task runner.

```md
---
schedule: "0 9 * * 1-5"   # weekdays 09:00 local
skill: morning-trend-scan
inputs:
  - "today"
---

# What this does

Each weekday morning, run `morning-trend-scan` and write the digest to
`vault/wiki/research/general/`.

# Failure mode

Skill is idempotent; safe to retry on failure.
```

Rules:

- Cron expression in `schedule:`. Use 24-hour, repo-local time zone.
- `skill:` references a skill by `name`, not folder path.
- The dashboard's forecast card reads these specs to show next-run times.
- Document the **failure mode** — is the skill idempotent? Should retries
  be skipped?

## File naming

- Local: `<skill-slug>.sh` — one script per skill.
- Remote: `<skill-slug>-<cadence>.md` — e.g. `morning-trend-scan-daily.md`.
