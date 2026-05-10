# Remote automations

Markdown specs registered with Claude Code's scheduled-task runner. They
run 24/7 on the remote, independent of the laptop being on.

Each spec has YAML frontmatter declaring `schedule:` (cron expression),
`skill:` (skill name), and `inputs:` (default args). See
`standards/automation-authoring.md`.

## Forecast

The dashboard's Forecast card reads every `*.md` in this directory,
parses each `schedule:` cron, computes the next fire time in repo-local
TZ, and lists the schedules sorted by next-run. The card shows the
skill, the cron, and a relative + absolute next-run timestamp.

Implementation: `dashboard/lib/schedules.ts`,
`dashboard/components/forecast-card.tsx`.

## Validation

Run before committing changes to any spec:

```bash
cd dashboard && npm run validate:automations
```

The validator checks:

- `schedule:` parses as a cron expression (via `cron-parser`).
- `skill:` matches the `name:` field of an existing
  `skills/**/SKILL.md`.
- Filename starts with `<skill>-` per
  `standards/automation-authoring.md`.

## Registering with Claude Code's scheduled-task runner

Each spec is registered separately. From a Claude Code session in this
repo:

1. Open the scheduled-task UI (`/schedule` or the equivalent slash
   command supported by your Claude Code version).
2. For each `automations/remote/<slug>.md`:
   - Cron: copy the `schedule:` field.
   - Command: `claude -p "Use the <skill> skill. Inputs: <inputs>"`
     where `<skill>` is the spec's `skill:` field and `<inputs>` are the
     `inputs:` joined.
   - Working directory: the repo root (so `vault/` and `skills/` resolve).
3. Verify the registration by running the spec once on demand and
   checking the dashboard's Recent Runs card for the resulting row.

After registration, the skill runs unattended on the remote on the
configured cadence. Local laptop state is irrelevant.

## Failure handling

Every spec must document its **failure mode** in the body — whether the
skill is idempotent, what state retrying touches, and whether retries
should be skipped. The scheduled-task runner does not enforce this; the
spec body is the human-readable contract.
