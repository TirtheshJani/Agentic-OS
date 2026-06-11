# Global search scans on demand; no persisted index

Global Search (across Conversations and Memory) parses the relevant files per query rather than maintaining a precomputed search index. The corpus is small — measured at 190 session files / 156 MB total, with a raw `grep` across all of it returning in ~11 ms warm — so an inverted index would be infrastructure (background scanner, cache file, staleness handling) solving a problem we don't have. This also keeps Global Search consistent with the project's no-database architecture, where all state lives in `~/.claude` on disk.

To keep the ⌘K palette responsive without a persisted index, the backend holds a **lazy in-memory cache** of extracted searchable text per file, keyed by file mtime: the first query after a change pays the parse cost (~1–2s cold), subsequent queries are instant string scans, and edits invalidate automatically because the mtime changes. Nothing is written to `data/*.json`.

## Considered Options

- **Persisted inverted index** (e.g. piggyback the analytics background scanner → `data/search_index.json`, or SQLite FTS): rejected. Faster cold queries, but adds cache staleness (edits invisible until the next scan tick), couples search to another feature, and contradicts the no-database stance — all to optimize a scan that already completes in milliseconds at current scale.

## Consequences

- Revisit if the corpus grows ~10× or if cold-query latency becomes noticeable; an index can be added behind the same search API without changing callers.
- The searchable-text extraction deliberately excludes `tool_result` output and images (signal-to-noise), so the cache stays small relative to the 156 MB on disk.
