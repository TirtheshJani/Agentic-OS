# Spec 0023 — Architecture design studio

**Status:** Shipped
**Owner:** TJ
**Date:** 2026-06-11
**Decision record:** ADR-019

Implementation follows the karpathy-guidelines skill.

## Context

TJ wants a system-design studio: diagram architectures on a canvas, keep design docs next to them, and have agents review designs against the actual code — all stored in the vault so Obsidian and agent runs can see it.

## Decisions (ADR-019)

1. **Excalidraw over tldraw.** `@excalidraw/excalidraw` 0.18.1 is MIT (tldraw's SDK requires a license key to remove its watermark), installs cleanly against React 19, serializes to plain JSON, and ships `exportToSvg`. Loaded client-only via `next/dynamic({ssr:false})` — the same rule as xterm and sigma. This is the only new npm dependency in the whole 0013-0023 wave.
2. **Storage is vault files, no DB.** `vault/projects/<slug>/design/<name>.excalidraw.json` (scene) + `<name>.svg` (exported client-side on every explicit save — text-searchable, diffable, Obsidian-renderable) + a `<name>.md` stub embedding the SVG so the diagram appears in the graph (the indexer only walks .md). Saves are explicit (button/Ctrl+S); no autosave (vault-watcher churn, half-drawn states in git). The stub is created once and never overwritten, so hand-written notes on it survive.
3. **AI design review = templated issue** (`designReviewIssue`, the third consumer of `lib/issueTemplates.ts`) filed against the project itself: the agent reads ARCHITECTURE.md + the exported SVGs (XML text — shape labels carry the design, no vision needed) + the worktree code, and writes `design/REVIEW-<date>.md` to the vault. Filed to backlog (review is deliberate, not auto-run).
4. **Design docs are vault notes** edited in the existing /notes view (linked from the studio), not an embedded second editor. ARCHITECTURE.md participates in agent context via the spec-0014 knowledge mechanism when placed under `knowledge/`; a follow-up may widen that glob to `design/` (noted).

## Files

`lib/design/canvases.ts` (list/read/save/delete, name + slug guards, md stub), routes `GET /api/projects/[slug]/design`, `GET/PUT/DELETE .../design/canvas/[name]`, `POST .../design/review`, views `/studio` (project picker) + `/studio/[slug]` (canvas tab strip, CanvasHost with imperative-API save + client-side SVG export, docs list, review button). Nav entry.

## Tests

`tests/canvases.test.ts` — scene round-trip with svg + stub, stub preservation on re-save, docs-vs-stub separation, traversal/slug guards, full delete. Canvas rendering verified manually (no DOM rig in the repo).

## Limitations

- 0014's worktree-context assembly reads `knowledge/`, not `design/` — design docs reach agents via the review issue's explicit paths until that glob is widened.
- Large scenes ride the default route body limit; raise per-route if it ever bites.
