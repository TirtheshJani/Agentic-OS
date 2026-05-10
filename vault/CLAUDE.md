# Vault — instructions for Claude Code

This is the memory layer of the Agentic OS. Skills write here; humans
read here; git syncs it.

## Folder map

| Folder | Purpose | Lifetime |
|---|---|---|
| `raw/` | Untransformed captures. Daily notes in `raw/daily/YYYY-MM-DD.md`. Cheap to write, cheap to delete. | Days–weeks |
| `wiki/<domain>/` | Codified knowledge. Promoted from `raw/` once a topic earns its own page. Domains mirror the `skills/` tree. | Long-lived |
| `outputs/` | Finished deliverables (drafts, reports, briefings). Anything an external reader sees. | Permanent |
| `projects/<slug>/` | Active multi-step initiatives, each with their own README. | Months |
| `archive/` | Read-only history. Move here when a topic stops being live. | Permanent |

## Conventions

- File names: kebab-case, no spaces, no capitals.
- Frontmatter on every wiki page:
  ```yaml
  ---
  domain: research/physics-ml
  source: <skill-name or 'human'>
  created: 2026-05-10
  updated: 2026-05-10
  tags: [...]
  ---
  ```
- Daily notes: `raw/daily/YYYY-MM-DD.md` with `date:` + `domain:` +
  `source:` frontmatter.
- Output files: `outputs/<YYYY-MM-DD>-<slug>.md` for one-shots,
  `outputs/<slug>/` for multi-file deliverables.

## What never goes here

- Secrets, tokens, API keys.
- Large binaries (>1 MB) — use Drive (Drive MCP) and link.
- Notes with no domain. If you can't pick a folder, the note isn't ready.

## Promotion (`raw/` → `wiki/`)

Trigger: a topic appears in ≥2 daily notes, or a daily review flags it.
Workflow: see `instructions/promote-raw-to-wiki.md`. Don't delete the
source raw notes — the promotion is one-way.

## Sync

Git only. No Obsidian Sync, iCloud, or Syncthing. Vault is part of the
repo and travels with it.

## Skill outputs

Every skill's `metadata.outputs` field declares where it writes. Honor
those paths. Don't write to `outputs/` unless producing a finished
deliverable; routine skill artifacts go to `wiki/<domain>/` or
`raw/daily/`.
