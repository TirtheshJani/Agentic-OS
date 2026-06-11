// dashboard/lib/rag/retrieval.ts
// Hybrid retrieval (spec 0013): vector cosine scan + FTS5, fused with
// Reciprocal Rank Fusion, then expanded one hop along the wikilink graph.
// Degrades to FTS + graph when no embedding provider is configured.
import { getDb } from "@/lib/db";
import { getEmbeddingProvider } from "@/lib/rag/providerRegistry";
import { dot } from "@/lib/rag/providers/types";
import { sanitizeFtsQuery } from "@/lib/rag/ftsQuery";

export type Retriever = "vector" | "fts" | "graph";

export interface RetrievedChunk {
  notePath: string;
  title: string;
  heading: string;
  chunkIndex: number;
  content: string;
  score: number;
  retrievers: Retriever[];
}

export interface RetrievalScope {
  pathPrefix?: string;
  /** Exact note paths to restrict to (overlays pathPrefix). */
  paths?: string[];
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  degraded: { vector: boolean; reason?: string };
  stats: { ftsHits: number; vectorCandidates: number; graphAdded: number; ms: number };
}

const CANDIDATES = 24;
const RRF_K = 60;
const GRAPH_SEEDS = 6;
const GRAPH_DECAY = 0.5;
/** Cosine floor: candidates below this are noise, not matches. */
const MIN_SIM = 0.1;

interface ChunkRow {
  notePath: string;
  heading: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
}

function chunkKey(c: { notePath: string; chunkIndex: number }): string {
  return `${c.notePath}#${c.chunkIndex}`;
}

function inScope(notePath: string, scope?: RetrievalScope): boolean {
  if (!scope) return true;
  if (scope.paths && scope.paths.length > 0 && !scope.paths.includes(notePath)) return false;
  if (scope.pathPrefix && !notePath.startsWith(scope.pathPrefix)) return false;
  return true;
}

function noteTitles(paths: string[]): Map<string, string> {
  if (paths.length === 0) return new Map();
  const placeholders = paths.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT path, title FROM notes WHERE path IN (${placeholders})`)
    .all(...paths) as Array<{ path: string; title: string }>;
  return new Map(rows.map((r) => [r.path, r.title]));
}

function firstChunkOf(notePath: string): ChunkRow | null {
  const row = getDb()
    .prepare(
      "SELECT note_path AS notePath, heading, chunk_index AS chunkIndex, content, content_hash AS contentHash FROM note_chunks WHERE note_path = ? ORDER BY chunk_index LIMIT 1"
    )
    .get(notePath) as ChunkRow | undefined;
  return row ?? null;
}

async function vectorCandidates(
  q: string,
  scope?: RetrievalScope
): Promise<{ ranked: ChunkRow[]; degraded: { vector: boolean; reason?: string }; candidates: number }> {
  const provider = getEmbeddingProvider();
  if (!provider) {
    return { ranked: [], degraded: { vector: true, reason: "no embedding provider configured" }, candidates: 0 };
  }
  let queryVec: Float32Array;
  try {
    queryVec = await provider.embedQuery(q);
  } catch (err) {
    return { ranked: [], degraded: { vector: true, reason: (err as Error).message }, candidates: 0 };
  }

  const where = scope?.pathPrefix ? "AND c.note_path LIKE ? || '%'" : "";
  const params: unknown[] = [provider.model];
  if (scope?.pathPrefix) params.push(scope.pathPrefix);
  const rows = getDb()
    .prepare(
      `SELECT c.note_path AS notePath, c.heading, c.chunk_index AS chunkIndex, c.content, c.content_hash AS contentHash, e.vector AS vector
       FROM note_chunks c
       JOIN chunk_embeddings e ON e.content_hash = c.content_hash AND e.model = ?
       WHERE 1=1 ${where}`
    )
    .all(...params) as Array<ChunkRow & { vector: Buffer }>;

  const scored = rows
    .filter((r) => inScope(r.notePath, scope))
    .map((r) => ({
      row: r as ChunkRow,
      sim: dot(new Float32Array(r.vector.buffer, r.vector.byteOffset, r.vector.byteLength / 4), queryVec),
    }))
    .filter((s) => s.sim > MIN_SIM)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, CANDIDATES);

  return { ranked: scored.map((s) => s.row), degraded: { vector: false }, candidates: rows.length };
}

function ftsCandidates(q: string, scope?: RetrievalScope): ChunkRow[] {
  const match = sanitizeFtsQuery(q);
  if (!match) return [];
  let rows: Array<{ path: string }>;
  try {
    rows = getDb()
      .prepare(`SELECT path FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT ?`)
      .all(match, CANDIDATES) as Array<{ path: string }>;
  } catch {
    return [];
  }
  const out: ChunkRow[] = [];
  for (const r of rows) {
    if (!inScope(r.path, scope)) continue;
    const chunk = firstChunkOf(r.path);
    if (chunk) out.push(chunk);
  }
  return out;
}

function graphExpand(seedPaths: string[], scope?: RetrievalScope): Map<string, ChunkRow> {
  const out = new Map<string, ChunkRow>();
  if (seedPaths.length === 0) return out;
  const placeholders = seedPaths.map(() => "?").join(",");
  const neighbors = getDb()
    .prepare(
      `SELECT DISTINCT n2.path AS path FROM notes n1
       JOIN note_links l ON l.source_id = n1.id
       JOIN notes n2 ON n2.id = l.target_id
       WHERE n1.path IN (${placeholders})
       UNION
       SELECT DISTINCT n1.path AS path FROM notes n1
       JOIN note_links l ON l.source_id = n1.id
       JOIN notes n2 ON n2.id = l.target_id
       WHERE n2.path IN (${placeholders})`
    )
    .all(...seedPaths, ...seedPaths) as Array<{ path: string }>;

  for (const n of neighbors) {
    if (seedPaths.includes(n.path) || !inScope(n.path, scope)) continue;
    const chunk = firstChunkOf(n.path);
    if (chunk) out.set(n.path, chunk);
  }
  return out;
}

export async function retrieve(opts: {
  q: string;
  k?: number;
  scope?: RetrievalScope;
  excludeThreads?: boolean;
}): Promise<RetrievalResult> {
  const started = Date.now();
  const k = opts.k ?? 8;
  const scope = opts.scope;

  const vector = await vectorCandidates(opts.q, scope);
  const fts = ftsCandidates(opts.q, scope);

  // Reciprocal Rank Fusion across the two ranked lists.
  const fused = new Map<string, { row: ChunkRow; score: number; retrievers: Set<Retriever> }>();
  const addRanked = (rows: ChunkRow[], retriever: Retriever) => {
    rows.forEach((row, rank) => {
      if (opts.excludeThreads !== false && /^projects\/[^/]+\/threads\//.test(row.notePath)) return;
      const key = chunkKey(row);
      const entry = fused.get(key) ?? { row, score: 0, retrievers: new Set<Retriever>() };
      entry.score += 1 / (RRF_K + rank + 1);
      entry.retrievers.add(retriever);
      fused.set(key, entry);
    });
  };
  addRanked(vector.ranked, "vector");
  addRanked(fts, "fts");

  const ranked = [...fused.values()].sort((a, b) => b.score - a.score);

  // One-hop wikilink expansion from the top fused notes.
  const seedPaths = [...new Set(ranked.slice(0, GRAPH_SEEDS).map((e) => e.row.notePath))];
  const neighbors = graphExpand(seedPaths, scope);
  let graphAdded = 0;
  const minSeedScore = ranked.length > 0 ? ranked[Math.min(GRAPH_SEEDS, ranked.length) - 1].score : 0;
  for (const [, chunk] of neighbors) {
    const key = chunkKey(chunk);
    if (fused.has(key)) continue;
    fused.set(key, { row: chunk, score: minSeedScore * GRAPH_DECAY, retrievers: new Set(["graph"]) });
    graphAdded++;
  }

  const final = [...fused.values()].sort((a, b) => b.score - a.score).slice(0, k);
  const titles = noteTitles([...new Set(final.map((e) => e.row.notePath))]);

  return {
    chunks: final.map((e) => ({
      notePath: e.row.notePath,
      title: titles.get(e.row.notePath) ?? e.row.notePath,
      heading: e.row.heading,
      chunkIndex: e.row.chunkIndex,
      content: e.row.content,
      score: e.score,
      retrievers: [...e.retrievers],
    })),
    degraded: vector.degraded,
    stats: {
      ftsHits: fts.length,
      vectorCandidates: vector.candidates,
      graphAdded,
      ms: Date.now() - started,
    },
  };
}
