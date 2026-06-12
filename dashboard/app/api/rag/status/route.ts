import { NextResponse } from "next/server";
import { openDb, getDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getSettings } from "@/lib/settings";
import { getEmbedWorkerStatus } from "@/lib/rag/embedWorker";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureServerBooted();
  openDb();
  const { rag } = getSettings();
  const db = getDb();
  const chunks = (db.prepare("SELECT COUNT(*) AS n FROM note_chunks").get() as { n: number }).n;
  const embedded = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT c.content_hash) AS n FROM note_chunks c
         JOIN chunk_embeddings e ON e.content_hash = c.content_hash AND e.model = ?`
      )
      .get(rag.embeddingModel) as { n: number }
  ).n;
  const distinct = (db.prepare("SELECT COUNT(DISTINCT content_hash) AS n FROM note_chunks").get() as { n: number }).n;

  return NextResponse.json({
    embeddingProvider: rag.embeddingProvider,
    model: rag.embeddingModel,
    dims: rag.embeddingDims,
    chunks,
    distinctHashes: distinct,
    embedded,
    pending: Math.max(0, distinct - embedded),
    lastError: getEmbedWorkerStatus().lastError,
    answerProvider: rag.answerProvider,
  });
}
