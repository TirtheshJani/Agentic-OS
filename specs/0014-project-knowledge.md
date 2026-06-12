# Spec 0014: Project Knowledge

> **Status:** Shipped. **Owner:** TJ. **Date:** 2026-06-11.

## Scope

Give each project a knowledge base that agents actually consume: uploaded
docs, freeform instructions, and an outputs folder, all surfaced on a
**Knowledge** tab of the project page and injected into every agent run.
Implementation follows the karpathy-guidelines skill.

Out of scope: PDF ingestion (deferred; text extraction needs a parser
dependency), per-doc embedding controls, knowledge sharing across
projects.

## Storage: plain vault files

Everything lives in the Obsidian vault, so the existing indexer, graph,
and RAG layer (spec 0013) pick it up with zero new plumbing:

| What | Where |
|---|---|
| Knowledge docs | `vault/projects/<slug>/knowledge/<name>.md` |
| Instructions | `vault/projects/<slug>/INSTRUCTIONS.md` |
| Outputs (agent deliverables) | `vault/projects/<slug>/outputs/` |

- Uploaded `.txt` files are wrapped to `.md` (the indexer and chokidar
  watcher only see `.md`); files without frontmatter get a minimal
  `source: upload` header. Doc names are slugified, traversal-guarded.
- Saves index the vault synchronously (the watcher debounce is 1.5s) and
  publish `vault.indexed`, so docs are queryable immediately.
- `INSTRUCTIONS.md` is a **separate file**, not a `PROJECT.md`
  frontmatter field: gray-matter round-tripping of multiline YAML strings
  is fragile, and a plain file is editable from Obsidian too.

## Run injection (`lib/promptAssembly.ts`)

Both runtimes collapse `initialPrompt` to a single PTY line, so context
cannot ride along in the prompt. Instead, `startRun`:

1. Retrieves the top `k=5` knowledge chunks for the issue title+body,
   scoped to `projects/<slug>/knowledge/`, dropping chunks below a
   `0.005` score floor (RRF scores are small).
2. Writes `AGENT_CONTEXT.md` into the worktree: instructions, the
   retrieved chunks, and the artifacts convention, capped at **12KB**.
3. Appends one pointer line to the prompt ("Read AGENT_CONTEXT.md ...").
4. Merge-appends the instructions into the worktree's `CLAUDE.md` (or
   `GEMINI.md` for gemini-cli) under a marker heading, idempotently,
   since the runtimes auto-read those files as a system-prompt prefix.

Injection is non-fatal: on any failure the run proceeds without context,
same posture as MCP config install.

## Artifacts convention

`AGENT_CONTEXT.md` tells every run to write finished deliverables
(reports, exports) to `vault/projects/<slug>/outputs/` by absolute path;
code changes stay in the worktree. The Knowledge tab lists outputs
read-only, newest first.

## API

- `GET /api/projects/[slug]/knowledge` →
  `{docs: [{name, relPath, size, mtime, chunkCount, embedded}], instructions: {exists, content}, outputs: [{name, relPath, mtime}]}`
- `POST /api/projects/[slug]/knowledge` `{name, content}` → 201
  `{relPath}` (client reads dropped files with FileReader; `.md`/`.txt`)
- `DELETE /api/projects/[slug]/knowledge/[name]` → `{ok}`
- `PUT /api/projects/[slug]/instructions` `{content}` → `{ok}`
- Project chat is just `POST /api/rag/ask` (spec 0013) with
  `scope.pathPrefix = "projects/<slug>/"`; no new endpoint.

## UI

The project page gains a tab strip (`ProjectTabs`: Board | Knowledge);
the Board tab renders the existing kanban/crew/worktrees unchanged.
`KnowledgeTab` shows: drag-drop upload zone + doc list with
`embedded/chunkCount` badges and delete; the instructions editor
("Injected into every agent run in this project as a system-prompt
prefix"); a collapsible project-chat panel (answer + citations); and the
read-only outputs list. Live refresh on `vault.indexed` and
`rag.embeddings` stream events.

## Tests

- `tests/projectKnowledge.test.ts` — doc save/list/delete, txt→md
  wrapping, name validation, instructions read/write, outputs listing.
- `tests/promptAssembly.test.ts` — context file assembly, 12KB cap,
  prompt suffix, idempotent CLAUDE.md/GEMINI.md merge-append.
