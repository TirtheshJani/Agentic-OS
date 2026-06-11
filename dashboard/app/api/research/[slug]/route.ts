import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getResearchProject, listSources, listResearchNotes } from "@/lib/research/projects";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug } = await params;
  const meta = getResearchProject(slug);
  if (!meta) return NextResponse.json({ error: "research project not found" }, { status: 404 });
  return NextResponse.json({ meta, sources: listSources(slug), notes: listResearchNotes(slug) });
}
