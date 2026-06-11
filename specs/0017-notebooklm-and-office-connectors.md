# Spec 0017 — NotebookLM bridge + Office/Google connector slots

**Status:** Shipped
**Owner:** TJ
**Date:** 2026-06-11
**Decision record:** ADR-014

Implementation follows the karpathy-guidelines skill.

## Context

TJ uses NotebookLM for source-grounded reading and wants vault notes and project knowledge available there without re-uploading by hand. He also wants Outlook/Word/Excel/Google Docs reachable by agents. NotebookLM has no general public API; its import path is Google Drive. ADR-011 forbids live credentials in the dashboard.

## Design

### NotebookLM export bridge

- `lib/export/notebooklm.ts` — `exportBundle({ paths, bundleName? })`: traversal-guarded copy of selected vault notes into `<exportDir>/<YYYY-MM-DD>-<bundle>/` (collision-suffixed), filenames flattened from vault paths (`wiki/topic-a.md` → `wiki-topic-a.md`) so provenance survives, `[[wikilinks]]` flattened to plain text (NotebookLM has no wikilink concept), plus a `_manifest.md` listing source paths and the export timestamp.
- Export dir = `settings.export.notebookLmDir`; empty default falls back to `vault/outputs/notebooklm/`. Pointing it at a Google Drive for Desktop synced folder (e.g. `G:\My Drive\NotebookLM-Inbox`) makes bundles appear in Drive with zero credentials; NotebookLM imports from Drive.
- `POST /api/export/notebooklm { paths, bundleName? }` → `201 { exportedTo, files }`.

### Connector slots

`lib/connections.ts` gains three `checkMcp` entries rendered automatically by `/connections`:

- `gdrive` — Google Drive (MCP). Setup notes flag that the reference `@modelcontextprotocol/server-gdrive` was archived; verify the current best fork when configuring.
- `gdocs` — Google Docs (MCP) template slot.
- `ms365` — Microsoft 365 (Outlook/Word/Excel); recommended candidate `softeria/ms-365-mcp-server` (Microsoft Graph, device-code auth).

These are template slots in the spec-0011 sense: status `not-configured` until the operator writes `.agentic-os/mcp/<id>.json`, then injected into run worktrees via the existing `mcp-servers:` frontmatter mechanism. No dashboard code couples to any of them.

## Settings

- `export.notebookLmDir: string` (default `""` → vault fallback). Editable in /settings → Export.

## UI

- /settings Export section (folder field).
- Bundle selection UI from the notes/knowledge views is deferred to a follow-up pass; the API is live and callable (documented limitation).

## Tests

- `tests/notebooklmExport.test.ts` — bundle layout, manifest, wikilink flattening, configured-dir use, collision suffixing, traversal/missing/empty rejections.

## Limitations

- Import into NotebookLM is a manual click in their UI (no API).
- Office/Google MCP server recommendations may go stale; that is why they are slots, not dependencies.
