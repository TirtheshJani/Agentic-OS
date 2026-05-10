# Remote automations

Markdown specs registered with Claude Code's scheduled-task runner. They
run 24/7 on the remote, independent of the laptop being on.

Each spec has YAML frontmatter declaring `schedule:` (cron expression),
`skill:` (skill name), and `inputs:` (default args). See
`standards/automation-authoring.md`.

## Forecast

The dashboard reads every `*.md` in this directory to populate the
"Forecast" card with upcoming runs.

## Registering

Out of scope for the bootstrap (Phase 4 of `product/roadmap.md`). When
ready, point the Claude Code scheduled-task runner at this directory.
