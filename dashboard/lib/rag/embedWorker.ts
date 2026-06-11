// dashboard/lib/rag/embedWorker.ts
// Background embedder: fills chunk_embeddings for hashes present in
// note_chunks but missing for the active model. Singleton on globalThis
// (dual-module-graph, same as lib/stream.ts). One batch in flight at a time;
// provider errors back off instead of throwing.
import { getDb } from "@/lib/db";
import { getEmbeddingProvider } from "@/lib/rag/providerRegistry";
import { publish, subscribe } from "@/lib/stream";

const BATCH_SIZE = 100;
const ERROR_BACKOFF_MS = 60_000;

interface WorkerState {
  running: boolean;
  lastError: string | null;
  backoffUntil: number;
  stop: () => void;
}

const globalKey = Symbol.for("agentic-os.embedWorker");
const g = globalThis as unknown as Record<symbol, WorkerState | undefined>;

export function getEmbedWorkerStatus(): { lastError: string | null } {
  return { lastError: g[globalKey]?.lastError ?? null };
}

function pendingHashes(model: string, limit: number): Array<{ hash: string; content: string }> {
  return (
    getDb()
      .prepare(
        `SELECT DISTINCT c.content_hash AS hash, c.content AS content
         FROM note_chunks c
         LEFT JOIN chunk_embeddings e ON e.content_hash = c.content_hash AND e.model = ?
         WHERE e.content_hash IS NULL
         LIMIT ?`
      )
      .all(model, limit) as Array<{ hash: string; content: string }>
  );
}

function pendingCount(model: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT c.content_hash) AS n
       FROM note_chunks c
       LEFT JOIN chunk_embeddings e ON e.content_hash = c.content_hash AND e.model = ?
       WHERE e.content_hash IS NULL`
    )
    .get(model) as { n: number };
  return row.n;
}

async function drain(state: WorkerState): Promise<void> {
  if (state.running) return;
  if (Date.now() < state.backoffUntil) return;
  const provider = getEmbeddingProvider();
  if (!provider) return;

  state.running = true;
  try {
    for (;;) {
      const batch = pendingHashes(provider.model, BATCH_SIZE);
      if (batch.length === 0) break;
      const vectors = await provider.embedDocuments(batch.map((b) => b.content));
      const insert = getDb().prepare(
        "INSERT OR REPLACE INTO chunk_embeddings (content_hash, model, dims, vector, created_at) VALUES (?, ?, ?, ?, ?)"
      );
      const now = Date.now();
      const tx = getDb().transaction(() => {
        for (let i = 0; i < batch.length; i++) {
          insert.run(batch[i].hash, provider.model, provider.dims, Buffer.from(vectors[i].buffer), now);
        }
      });
      tx();
      state.lastError = null;
      const pending = pendingCount(provider.model);
      const embedded = (
        getDb().prepare("SELECT COUNT(*) AS n FROM chunk_embeddings WHERE model = ?").get(provider.model) as { n: number }
      ).n;
      publish({ kind: "rag.embeddings", embedded, pending, model: provider.model });
      if (pending === 0) break;
    }
  } catch (err) {
    state.lastError = (err as Error).message;
    state.backoffUntil = Date.now() + ERROR_BACKOFF_MS;
    console.error("[rag] embed worker error:", err);
    publish({
      kind: "rag.embeddings",
      embedded: 0,
      pending: pendingCount(provider.model),
      model: provider.model,
      error: state.lastError,
    });
  } finally {
    state.running = false;
  }
}

/** Start the worker: drains on boot and after every vault reindex. Singleton. */
export function startEmbedWorker(): () => void {
  if (g[globalKey]) return g[globalKey]!.stop;

  const state: WorkerState = {
    running: false,
    lastError: null,
    backoffUntil: 0,
    stop: () => {},
  };
  const unsubscribe = subscribe((event) => {
    if (event.kind === "vault.indexed") void drain(state);
  });
  state.stop = () => {
    unsubscribe();
    g[globalKey] = undefined;
  };
  g[globalKey] = state;
  void drain(state);
  return state.stop;
}

/** Kick a drain manually (reindex route). */
export function kickEmbedWorker(): void {
  const state = g[globalKey];
  if (state) {
    state.backoffUntil = 0;
    void drain(state);
  }
}
