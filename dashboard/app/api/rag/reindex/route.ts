import { NextResponse } from "next/server";
import { openDb, getDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getSettings } from "@/lib/settings";
import { indexVault } from "@/lib/vault/indexer";
import { kickEmbedWorker } from "@/lib/rag/embedWorker";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let force = false;
  try {
    const body = (await req.json()) as { force?: boolean };
    force = body.force === true;
  } catch {
    // empty body is fine
  }

  if (force) {
    const { rag } = getSettings();
    getDb().prepare("DELETE FROM chunk_embeddings WHERE model = ?").run(rag.embeddingModel);
  }
  const stats = indexVault();
  kickEmbedWorker();
  return NextResponse.json({ ok: true, notes: stats.notes, forced: force });
}
