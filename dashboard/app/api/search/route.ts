import { NextResponse } from "next/server";
import { openDb, getDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { sanitizeFtsQuery } from "@/lib/rag/ftsQuery";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureServerBooted();
  openDb();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const match = sanitizeFtsQuery(q);

  try {
    const results = getDb()
      .prepare(
        `SELECT path, title, snippet(notes_fts, 1, '<b>', '</b>', ' ... ', 12) AS snippet
         FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT 50`
      )
      .all(match);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[search] FTS query failed:", err);
    return NextResponse.json({ results: [], error: "search failed" }, { status: 500 });
  }
}
