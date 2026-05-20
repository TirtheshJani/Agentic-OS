---
name: vault-recall
description: Semantic search over the user's Obsidian vault and Claude auto-memory using local embeddings (sqlite-vec + MiniLM). Invoke BEFORE answering any question that references the user's projects, prior research, ongoing work, or recurring themes. Triggers include "what was I doing with X", "find my notes on Y", "do I have anything about Z", "remember when I", project-name mentions, paper-topic mentions, or any question that would benefit from prior context. Returns top-k matching chunks with file paths so the next step is Read of the full file. Local-only, offline, zero API cost. Run vault-recall-index after large vault changes to refresh the index.
license: MIT
allowed-tools: Bash Read
metadata:
  status: authored
  domain: _meta
  mode: local
  mcp-server: none
  external-apis: []
  outputs: []
---

# Vault Recall

A local RAG over `vault/wiki/`, `vault/projects/`, `vault/raw/daily/`, and the
Claude auto-memory directories under `~/.claude/projects/*/memory/`. Embeddings
are computed with a quantized MiniLM model and stored in `.agentic-os/state.db`
via `sqlite-vec`. No network calls at query time.

## When to invoke

Run a query BEFORE you answer if the user's message:

- Names a project (e.g. `stellar-mk-audit`, `fhir-rag-paper`, `Agentic-OS`)
- Mentions ongoing work ("the paper I'm writing", "that bug last week")
- Asks "do I have notes on", "what was I doing with", "remember when"
- References a recurring topic (e.g. a paper title, a person's name)
- Could be answered better with prior context (judgment call)

If the user explicitly says "no memory" or "ignore vault", skip.

## Setup (one-time)

```bash
cd skills/_meta/vault-recall
npm install
node scripts/index.mjs --full
```

First run downloads the MiniLM model (~25 MB) to `~/.cache/huggingface/`.
Re-runs are incremental: only files whose mtime changed get re-embedded.

## Querying

```bash
cd skills/_meta/vault-recall
node scripts/query.mjs "your natural-language query" [--k 8]
```

Output is JSON on stdout. Shape:

```json
{
  "query": "...",
  "results": [
    {
      "path": "vault/projects/stellar-mk-audit/PROJECT.md",
      "chunk_index": 2,
      "distance": 0.31,
      "text": "..."
    }
  ]
}
```

Read the file with the Read tool when a snippet looks promising. Snippets are
truncated; always Read the source before quoting.

## Re-indexing

```bash
cd skills/_meta/vault-recall
node scripts/index.mjs           # incremental (default)
node scripts/index.mjs --full    # rebuild from scratch
node scripts/index.mjs --paths vault/wiki   # subset
```

The corresponding local automation is `automations/local/vault-recall-index.sh`.

## What gets indexed

- `vault/wiki/**/*.md`
- `vault/projects/**/*.md`
- `vault/raw/daily/**/*.md`
- `~/.claude/projects/*/memory/*.md`

Frontmatter is stripped before embedding so YAML noise does not poison
similarity. Files smaller than 80 chars are skipped.

## What gets stored

Two tables in `.agentic-os/state.db`:

- `vault_chunks_meta(rowid, path, chunk_index, chunk_text, file_mtime, indexed_at)`
- `vault_chunks_vec(rowid, embedding float[384])`  — `vec0` virtual table

Joined on `rowid`. Distance metric is L2 on L2-normalized vectors (= cosine
ranking).

## Limitations

- MiniLM is small. Recall on long, abstract queries is OK but not great.
  If the first query returns weak matches, rephrase with more concrete terms.
- The index lags reality by the time since the last `index.mjs` run.
- Code files are NOT indexed. Use Grep for code.
