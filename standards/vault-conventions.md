# Vault conventions

The vault at `./vault` is the memory layer. Keep it boring and queryable.

## Folder purpose

| Folder | Purpose |
|---|---|
| `raw/` | Untransformed captures. Daily notes, scratch, link dumps. Cheap to write, cheap to delete. |
| `wiki/` | Codified knowledge. Promoted from `raw/` once a topic earns its own page. Domain-bucketed. |
| `outputs/` | Finished deliverables (drafts, reports). Anything someone outside the vault might read. |
| `projects/` | Active multi-step initiatives. Each subfolder is one project with its own README. |
| `archive/` | Read-only history. Move here when something stops being live. |

## Daily notes

- Path: `raw/daily/YYYY-MM-DD.md`.
- Frontmatter:

  ```yaml
  ---
  date: 2026-05-10
  domain: [research/physics-ml, content/substack]
  source: claude-code
  ---
  ```

## Wiki pages

- Path: `wiki/<domain>/<topic-kebab>.md`. Domain mirrors the `skills/`
  domain tree: `research/{general,physics-ml,healthcare-tech,data-science}`,
  `content/{substack,anxious-nomad,community}`, `coding`, `business`,
  `productivity`.
- Frontmatter:

  ```yaml
  ---
  domain: research/physics-ml
  source: arxiv-daily-digest
  created: 2026-05-10
  updated: 2026-05-10
  tags: [diffusion-models, attention, scaling-laws]
  ---
  ```

- File names kebab-case. No spaces, no capitals.

## Outputs

- Path: `outputs/<YYYY-MM-DD>-<slug>.md` for one-shot deliverables, or a
  subfolder per multi-file output.
- A skill writes to `outputs/` only when producing something a human or
  external system will read directly.

## Promotion workflow (`raw/` → `wiki/`)

When a topic in `raw/` is mentioned ≥2 times across daily notes, the
`promote-raw-to-wiki` instruction kicks in: consolidate the raw mentions
into a single `wiki/<domain>/<topic>.md`, link the source raw notes, and
update frontmatter.

## What never goes in the vault

- Secrets, tokens, API keys.
- Large binaries (>1 MB). Use Drive (via the Drive MCP) and link.
- Anything with no domain. If you can't pick a folder, the note isn't ready.

## Sync

Git is the only sync mechanism. No Obsidian Sync, iCloud, or Syncthing.
The vault is part of the repo and travels with it.
