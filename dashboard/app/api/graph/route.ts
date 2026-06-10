import { NextResponse } from "next/server";
import { openDb, getDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";

export const dynamic = "force-dynamic";

interface NoteRow {
  id: number;
  path: string;
  title: string;
  folder: string;
  tags: string | null;
}

interface LinkRow {
  source_id: number;
  target_id: number | null;
  target_raw: string;
}

export async function GET(req: Request) {
  await ensureServerBooted();
  openDb();
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder");
  const tag = searchParams.get("tag");

  const db = getDb();
  let rows: NoteRow[];
  if (folder) {
    rows = db.prepare("SELECT id, path, title, folder, tags FROM notes WHERE folder = ?").all(folder) as NoteRow[];
  } else {
    rows = db.prepare("SELECT id, path, title, folder, tags FROM notes").all() as NoteRow[];
  }

  const notes = rows
    .map((r) => ({ ...r, tagList: (r.tags ? JSON.parse(r.tags) : []) as string[] }))
    .filter((r) => !tag || r.tagList.includes(tag));

  const included = new Set(notes.map((n) => n.id));
  const links = db
    .prepare("SELECT source_id, target_id, target_raw FROM note_links")
    .all() as LinkRow[];

  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);

  const edges: Array<{ source: string; target: string }> = [];
  const ghosts = new Map<string, string>(); // key -> display label

  for (const link of links) {
    if (!included.has(link.source_id)) continue;
    const source = `n${link.source_id}`;
    if (link.target_id != null) {
      if (!included.has(link.target_id)) continue;
      const target = `n${link.target_id}`;
      edges.push({ source, target });
      bump(source);
      bump(target);
    } else {
      // Unresolved wikilink: render the target as a ghost node.
      const key = `ghost:${link.target_raw.toLowerCase()}`;
      ghosts.set(key, link.target_raw);
      edges.push({ source, target: key });
      bump(source);
      bump(key);
    }
  }

  const nodes = [
    ...notes.map((n) => ({
      id: `n${n.id}`,
      title: n.title,
      path: n.path,
      folder: n.folder,
      tags: n.tagList,
      degree: degree.get(`n${n.id}`) ?? 0,
      ghost: false,
    })),
    ...Array.from(ghosts.entries()).map(([id, label]) => ({
      id,
      title: label,
      path: null,
      folder: "(unresolved)",
      tags: [] as string[],
      degree: degree.get(id) ?? 0,
      ghost: true,
    })),
  ];

  return NextResponse.json({ nodes, edges });
}
