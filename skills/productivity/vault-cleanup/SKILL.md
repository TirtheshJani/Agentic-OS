---
name: vault-cleanup
description: List vault/raw/ files older than a configurable threshold (default 30 days), propose moves to vault/archive/ or promotions to vault/wiki/, and apply on confirmation. Use when the user asks to "clean up the vault", "archive old notes", "vault hygiene", "vault cleanup".
license: MIT
metadata:
  status: authored
  domain: productivity
  mode: remote
  mcp-server: none
  external-apis: [none]
  outputs: [vault/archive/ (moves), vault/wiki/<domain>/ (promotions), vault/raw/daily/<YYYY-MM-DD>-cleanup-report.md]
---

# vault-cleanup

Orchestration pattern: **iterative refinement (dry-run first)**. The
skill always produces a written proposal before mutating anything. If
the user confirms, a second pass applies the moves using `git mv` /
`git rm`. Bias: when in doubt, archive, not delete.

## References

- `vault/CLAUDE.md` — folder map, what never goes in the vault,
  promotion workflow.
- `instructions/promote-raw-to-wiki.md` — formal `raw/` → `wiki/`
  workflow.

## Instructions

1. **Inventory.** Walk `vault/raw/` and `vault/raw/daily/`. For each
   file, compute its "age" using git's last-touch time (`git log -1
   --format=%ct -- <path>`), not filesystem mtime — a fresh clone
   resets mtime but git history is stable.
2. **Classify** each file older than the threshold (default 30 days):
   - **Archive candidate:** referenced ≤1 time in any wiki page; no
     `- [ ]` open checkboxes; no `keep` tag in frontmatter.
   - **Promote candidate:** appears in ≥2 daily notes by name or wiki
     link, or has a `promote` tag in frontmatter.
   - **Keep:** open checkboxes present, or `keep` tag, or referenced
     ≥2 times in current wiki pages.
3. **Write the dry-run report** to
   `vault/raw/daily/<YYYY-MM-DD>-cleanup-report.md`. Three sections:
   `## Propose archive`, `## Propose promote`, `## Keep`. List file
   paths + reason for each entry.
4. **Stop and ask.** Do not mutate the vault on this pass. Surface the
   report path and a count summary in the response.
5. **On confirmation** (the user says "go" / "apply" / re-runs with
   `--apply`):
   - For archive candidates: `git mv vault/raw/<path>
     vault/archive/<path>`. Preserves history.
   - For promote candidates: read the source, consolidate per
     `instructions/promote-raw-to-wiki.md` into
     `vault/wiki/<domain>/<slug>.md`, then `git mv` the source into
     `vault/archive/`. Promotion is one-way; source is not deleted,
     just archived with backlinks.
   - Update the cleanup report with a `## Applied` section noting
     what moved.

## Inputs

- `threshold_days` (optional, int). Default: 30.
- `--apply` (optional flag). Default: false (dry-run only).
- `subtree` (optional, path under `vault/raw/`). Default: entire `raw/`.

## Outputs

- `vault/raw/daily/<YYYY-MM-DD>-cleanup-report.md` (always)
- Moves under `vault/archive/<path>` (only when `--apply`)
- Promotions under `vault/wiki/<domain>/<slug>.md` (only when `--apply`)

## Examples

User: "clean up the vault"

→ Skill finds 47 files older than 30 days. 12 archive candidates, 3
promote candidates, 32 keep. Writes report; surfaces:

> Found 47 files >30d old. Proposed 12 archives, 3 promotions, 32
> keeps. See `vault/raw/daily/2026-05-10-cleanup-report.md`. Re-run
> with `--apply` to act on it.

User: "go"

→ Skill re-reads the report, applies. `git mv` 12 files into
`archive/`, consolidates 3 promotions into `wiki/<domain>/`,
archives their sources. Updates report with `## Applied`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Age 0 days" on every file | Using filesystem mtime, not git ctime | Switch to `git log -1 --format=%ct -- <path>` |
| Promotion overwrote a wiki page | Target slug collision | Always check target exists; if so, append a `## from raw/...` section instead of overwriting |
| `git mv` failed: "no such file" | File already moved in a prior run | Skip + log as "already archived"; do not retry |
| File flagged "keep" but the user expected archive | Stale wiki backlinks counting toward the ≥2 threshold | Add `archive` tag to the file's frontmatter to override |
