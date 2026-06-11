import { NextResponse } from "next/server";
import { openDb, getDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureServerBooted();
  openDb();
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder");

  const rows = folder
    ? getDb()
        .prepare("SELECT path, title, folder, mtime FROM notes WHERE folder = ? ORDER BY mtime DESC LIMIT 500")
        .all(folder)
    : getDb().prepare("SELECT path, title, folder, mtime FROM notes ORDER BY mtime DESC LIMIT 500").all();
  const folders = getDb().prepare("SELECT DISTINCT folder FROM notes ORDER BY folder").all() as Array<{ folder: string }>;
  return NextResponse.json({ notes: rows, folders: folders.map((f) => f.folder) });
}
