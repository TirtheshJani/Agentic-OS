# Spec 0016: LightRAG Integration

> **Status:** Shipped. **Owner:** TJ. **Date:** 2026-06-11.

## Scope

Connect the dashboard to the operator's locally running LightRAG
instance (default port 9621): auto-ingest finished agent runs into the
LightRAG knowledge base, and surface instance/MCP status on the
Connections page. Implementation follows the karpathy-guidelines skill.

No new UI beyond the Connections page auto-rendering the new detector;
the Settings toggle for `lightrag.autoIngest` is being added separately
on the settings page. Agents query LightRAG via MCP using the existing
`lib/mcp.ts` template injection — no new query plumbing here.

This spec supersedes `docs/roadmap/lightrag-mcp.md`. The roadmap's
"write the MCP config in `lib/runtime/claude-code.ts`" guidance is
obsolete: `lib/mcp.ts` templates already inject per-worktree MCP config
for any project that lists the server in `PROJECT.md` `mcp-servers:`.

## `run.finalized` stream event

`finalizeRunExit` in `lib/startRun.ts` (the idempotent run-exit
persister, called from both the spawn-time PTY onExit listener and the
WebSocket handler) now publishes:

```ts
{ kind: "run.finalized", runId, issueId, projectSlug, exitStatus }
```

where `exitStatus` is `"done"` (exit code 0, no signal) or `"failed"`.
This is the generic "a run just ended and was persisted" signal; the
ingest worker is its first consumer.

## Settings

`lib/settings.ts` gains a `lightrag` block:

```ts
lightrag: {
  baseUrl: "http://localhost:9621",  // default
  autoIngest: false,                 // default off
}
```

## Ingest worker (`lib/lightrag/ingestWorker.ts`)

A singleton `globalThis`-hoisted subscriber on `run.finalized`
(`startLightragIngestWorker`, started from server boot). For each
event it applies, in order:

1. **Global gate**: `settings.lightrag.autoIngest` must be true.
2. **Clean exits only**: `exitStatus === "done"`; failed runs never
   ingest.
3. **Project gate**: the project's `PROJECT.md` frontmatter must set
   `lightrag-ingest: true`. Double gating is deliberate — the roadmap's
   pollution concern — so neither a global flip nor a single project
   opt-in alone starts ingesting.
4. **Dedupe**: skip if `run_id` already exists in
   `lightrag_ingest_log` (schema migration V6: `run_id` INTEGER
   PRIMARY KEY, `ingested_at`, `status`). `finalizeRunExit` is itself
   idempotent, but the log also survives restarts and replays.

The payload is the issue title + body plus the rendered thread events,
POSTed as:

```
POST {baseUrl}/documents/text
{ "text": "...", "file_source": "agentic-os/run-<id>" }
```

with a 15s timeout. Implementation caveat: the `/documents/text` field
names (`text`, `file_source`) follow the current LightRAG server API
and should be verified against the locally installed LightRAG version
before relying on `file_source` for provenance queries.

**Failure posture**: any fetch error or non-2xx is logged to the
console and recorded in `lightrag_ingest_log` with `status: "failed"`;
ingest never throws into, blocks, or delays run finalization.

## Connections detector

`lib/connections.ts` adds a `lightrag` connector:

- **Probe**: HTTP GET `{baseUrl}/health` (recent LightRAG versions)
  falling back to `{baseUrl}/` for older ones, 2s timeout each.
- **unavailable**: instance unreachable; setup hints say to start the
  server / fix the base URL in Settings.
- **not-configured**: instance reachable but no MCP template at
  `.agentic-os/mcp/lightrag.json`; recommends `daniel-lightrag-mcp`
  (set `LIGHTRAG_BASE_URL`) and adding `mcp-servers: [lightrag]` to a
  project's `PROJECT.md` frontmatter.
- **connected**: instance reachable and template present; detail shows
  server count and the auto-ingest on/off state.

The Connections page renders this with zero page changes (it lists
whatever `getConnectionStatuses()` returns).

## Tests

`tests/lightragWorker.test.ts` — global-toggle gate, project-opt-in
gate, failed-run skip, single ingest + dedupe by run id, failure
recorded without throwing.
