# Spec 0013: Vault RAG Foundation (Ask Vault)

> **Status:** Shipped. **Owner:** TJ. **Date:** 2026-06-11. See ADR-013.
>
> Implementation follows the karpathy-guidelines skill.

## Context

Spec 0010 made the vault queryable (notes index, wikilinks, FTS5), but
answering a question still meant eyeballing search snippets. This spec adds
native retrieval-augmented generation over the vault: heading-aware
chunking, embeddings, hybrid retrieval, and a grounded one-shot answer with
`[n]` citations, surfaced in a new `/ask` view. The vault stays the source
of truth; chunks and embeddings are derived state in the same SQLite
database, rebuilt or back-filled at will.

## Decisions

- **BLOB cosine scan, no native vector dep.** Embeddings are stored as
  `Float32Array` BLOBs in `chunk_embeddings` and scanned with an in-process
  dot product. At vault scale (hundreds of notes, low thousands of chunks)
  a full scan is sub-millisecond territory and avoids the `sqlite-vec`
  native-module build on Windows. The provider/scan seam is the swap-in
  interface if the vault ever outgrows this (ADR-013).
- **Hash-keyed embedding cache.** `chunk_embeddings` is keyed by
  `(content_hash, model)`, not by note path or chunk id. Full index
  rebuilds (spec 0010 rebuilds notes on every change) never invalidate
  embeddings for unchanged content; only changed chunks are re-embedded.
- **CLI answer providers, no new uncontrolled `claude -p` sites.**
  Grounded answers are one-shot CLI calls: `gemini-cli` (default, bills the
  Google AI Pro account) or `claude-cli` (explicit opt-in; it draws from
  the monthly Agent SDK credit pool, same policy as the two existing
  headless call sites). The answer call is never looped or retried, and
  `none` disables generation entirely (retrieval-only UI).
- **Embeddings: `gemini-embedding-001` at 768 dims.** Truncated
  (non-3072-dim) Gemini vectors are not pre-normalized, so every vector is
  L2-normalized before storage; cosine similarity becomes a dot product.

## Design

### Chunking (`lib/rag/chunker.ts`)

Heading-aware markdown chunking: the body splits into sections on `##` /
`###` headings with an `h2 > h3` breadcrumb. Sections pack toward a
**1600-char target** with a **2400-char hard max** (oversize text splits
with **200-char overlap**); trailing fragments under **300 chars** merge
into the previous chunk. The embedded text (`embedText`) prepends the note
title and heading breadcrumb so context survives chunk isolation; the
SHA-256 `contentHash` keys the embedding cache.

### Sync and embedding (`lib/rag/chunkSync.ts`, `lib/rag/embedWorker.ts`)

`indexVault()` calls `syncNoteChunks()` after every notes rebuild: chunks
are diffed per note (not truncated), deleted notes drop their chunks.
The embed worker is a `globalThis` singleton (liveRuns precedent) that
drains pending hashes in batches of 100 on boot and after each
`vault.indexed` event, publishing `rag.embeddings`
`{embedded, pending, model, error?}` progress on the SSE bus. Provider
errors set `lastError` and back off 60s instead of throwing.

### Hybrid retrieval (`lib/rag/retrieval.ts`)

1. **Vector**: cosine scan of all embedded chunks, floor `MIN_SIM = 0.1`
   (below is noise, not a match), top 24.
2. **FTS**: sanitized FTS5 match over `notes_fts`, top 24, mapped to each
   note's first chunk.
3. **Fusion**: Reciprocal Rank Fusion with `k = 60` across both lists.
4. **Graph**: one-hop wikilink expansion from the top 6 fused notes; new
   neighbors enter at the weakest seed score times a **0.5 decay**.

Each returned chunk carries its `retrievers` provenance
(`vector` / `fts` / `graph`). Scope filters (`pathPrefix`, exact `paths`)
apply to every retriever. **Degraded mode**: with no embedding provider
(or an embed-query failure) the vector leg returns empty and
`degraded.vector = true` with a reason; FTS + graph still work, so the
feature is useful before any API key is configured.

### Answering (`lib/rag/ask.ts`, `lib/rag/answer/cliAnswer.ts`)

`askVault()` builds a numbered-context prompt from the top chunks, runs
the configured CLI once (prompt over stdin; 60s timeout), and parses `[n]`
citations from the reply back to chunk note paths. CLI failure returns the
chunks plus an `error` (HTTP 502) so the UI can always show retrieval.

## API

- `POST /api/rag/ask` `{q, k?, scope?}` → `{answer, provider, citations,
  chunks, degraded, error?}`; 502 when the answer CLI fails (body still
  has chunks).
- `POST /api/rag/query` — retrieval only: `{chunks, degraded, stats}`.
- `GET /api/rag/status` → `{embeddingProvider, model, dims, chunks,
  distinctHashes, embedded, pending, lastError, answerProvider}`.
- `POST /api/rag/reindex` `{force?}` → `{ok, notes, forced}`; `force`
  drops cached embeddings for the active model first.

## Settings

`settings.rag` (file-backed, `lib/settings.ts`): `embeddingProvider`
(`none` default | `gemini`), `geminiApiKey`, `embeddingModel`
(`gemini-embedding-001`), `embeddingDims` (768), `answerProvider`
(`gemini-cli` default | `claude-cli` | `none`). Edited in the Settings
page "Knowledge / RAG" section, which also shows live embed progress (via
`rag.embeddings` SSE events) and a confirm-gated "Re-embed all" button.

## UI

`/ask` (nav: "Ask Vault"): question textarea (Enter submits), optional
path-prefix scope behind an Advanced disclosure, answer with citation
chips that open a note preview drawer, and a "Retrieved context" list of
chunk cards (score, retriever badges, expandable content). Degraded mode
renders a yellow banner linking to Settings; `answerProvider: none`
renders retrieval-only with an info note.

## Tests

`chunker.test.ts` (section splitting, packing bounds, overlap, hash
stability), `chunkSync.test.ts` (diffing, cache survival across rebuilds),
`embedWorker.test.ts` (drain, backoff, events), `retrieval.test.ts`
(fusion, graph expansion, scope, degraded), `ragAsk.test.ts` (prompt
build, citation parsing, provider fallbacks).

## Limitations

- Cosine scan is O(chunks) per query; fine at current scale, see ADR-013
  reversal condition.
- FTS and graph retrievers resolve to a note's first chunk, not the best
  chunk within the note.
- Answer quality is bounded by the one-shot CLI reply; there is no
  multi-turn refinement by design (cost policy).
- Single embedding model at a time; switching models re-embeds everything
  (cache is keyed per model).
