# Spec 0010: Knowledge Layer (Vault Index, Graph, Search)

> **Status:** Shipped with the command-center build (June 2026).

## Goal

The Obsidian vault becomes queryable from the dashboard: a SQLite index of
notes, wikilinks, and tags powers an interactive graph view, full-text
search, and (in spec 0011) the inbox. The vault stays the source of truth;
the index is disposable and rebuilt at will.

## Vault as Obsidian vault

`vault/.obsidian/app.json` was already committed (May 2026) with
`.gitignore` excluding only `workspace*` and `cache`; no change needed.
The graph page links nodes back via `obsidian://open?vault=vault&file=...`.

## Index (`lib/vault/indexer.ts`, schema v4)

- `indexVault(rootDir = VAULT_DIR)`: walks `vault/**/*.md` (skipping
  `.obsidian`, `.trash`), parses frontmatter via gray-matter, extracts:
  title (frontmatter title, else first H1, else basename), top-level
  folder, tags (frontmatter array/string plus inline `#tags`), and
  `[[wikilink]]` targets.
- Full transactional rebuild every time: DELETE + INSERT of `notes`,
  `note_links`, `notes_fts`. The vault is a few hundred files; a rebuild
  stays under ~100ms, so there is no incremental path to get wrong.
- Link resolution: target key is the last path segment, lowercased, with
  `.md` stripped; matched against note basenames and titles (first writer
  wins on duplicates). Unresolved targets keep `target_raw` and render as
  ghost nodes.
- `startVaultWatcher()`: chokidar watch with a 1.5s debounce; each settle
  triggers a full reindex and publishes `vault.indexed` on the stream bus
  (new event kind), which the graph page uses to live-refresh.
- Boot: `ensureServerBooted()` runs an initial index and starts the
  watcher.

Schema v4 (applied on boot): `notes` (path UNIQUE, basename, title,
folder, tags JSON, mtime, indexed_at), `note_links` (source_id,
target_id NULLABLE, target_raw), `notes_fts` FTS5 (title, body, path).

## APIs

- `GET /api/graph?folder=&tag=`: `{ nodes, edges }` with per-node degree,
  ghost nodes for unresolved wikilinks.
- `GET /api/search?q=`: FTS5 match (every term quoted, so user input
  cannot inject query syntax), top 50 with snippets.
- `GET /api/notes?path=`: raw markdown, path-traversal guarded to
  VAULT_DIR.

## Graph view (`/graph`)

`components/graph/GraphView.tsx` uses sigma v3 + graphology +
forceatlas2 imported dynamically inside `useEffect` (same SSR pattern as
xterm). The `@react-sigma` binding was skipped on purpose: React 19
compatibility was unverified and the direct wrapper is ~100 lines.
Features: folder and tag filters, search box that both dims non-matching
nodes and runs FTS (result list opens previews), node size by degree,
color by top-level folder, click opens a preview drawer with the raw
markdown and an Open in Obsidian link.

## Out of scope

Embedding-based similarity (the index is lexical), cross-vault search,
writing to the vault from the graph UI, safishamsi/graphify integration
(can layer on later via MCP if code knowledge graphs become a need).
