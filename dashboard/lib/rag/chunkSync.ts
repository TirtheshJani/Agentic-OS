// dashboard/lib/rag/chunkSync.ts
// Incremental chunk sync: called by indexVault() after every full notes
// rebuild. note_chunks is diffed per note (not truncated), and
// chunk_embeddings is keyed by content hash so unchanged content is never
// re-embedded across rebuilds.
import { getDb } from "@/lib/db";
import { chunkNote } from "@/lib/rag/chunker";
import type { ParsedNote } from "@/lib/vault/indexer";

export interface ChunkSyncStats {
  changed: number;
  removed: number;
  total: number;
}

export function syncNoteChunks(parsed: ParsedNote[]): ChunkSyncStats {
  const db = getDb();
  const now = Date.now();
  let changed = 0;
  let removed = 0;
  let total = 0;

  const existingHashes = db.prepare(
    "SELECT chunk_index, content_hash FROM note_chunks WHERE note_path = ? ORDER BY chunk_index"
  );
  const deleteNote = db.prepare("DELETE FROM note_chunks WHERE note_path = ?");
  const insertChunk = db.prepare(
    "INSERT INTO note_chunks (note_path, chunk_index, heading, content, content_hash, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const allPaths = db.prepare("SELECT DISTINCT note_path FROM note_chunks");

  const run = db.transaction(() => {
    const livePaths = new Set(parsed.map((p) => p.relPath));

    // Remove chunks for deleted notes.
    for (const row of allPaths.all() as Array<{ note_path: string }>) {
      if (!livePaths.has(row.note_path)) {
        deleteNote.run(row.note_path);
        removed++;
      }
    }

    for (const note of parsed) {
      const chunks = chunkNote({ relPath: note.relPath, title: note.title, body: note.body });
      total += chunks.length;
      const existing = existingHashes.all(note.relPath) as Array<{ chunk_index: number; content_hash: string }>;
      const unchanged =
        existing.length === chunks.length &&
        existing.every((row, i) => row.chunk_index === i && row.content_hash === chunks[i].contentHash);
      if (unchanged) continue;

      deleteNote.run(note.relPath);
      for (const c of chunks) {
        insertChunk.run(note.relPath, c.chunkIndex, c.heading, c.embedText, c.contentHash, now);
      }
      changed++;
    }
  });
  run();

  return { changed, removed, total };
}

/**
 * Drop cached embeddings whose content hash no longer appears in note_chunks.
 * Run on boot only: keeps the cache bounded while letting it survive the
 * indexer's full rebuilds (which never touch chunk_embeddings).
 */
export function pruneEmbeddingCache(): number {
  const db = getDb();
  const info = db
    .prepare("DELETE FROM chunk_embeddings WHERE content_hash NOT IN (SELECT content_hash FROM note_chunks)")
    .run();
  return info.changes;
}
