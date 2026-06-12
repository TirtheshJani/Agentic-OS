import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getProject } from "@/lib/projects";
import { deleteKnowledgeDoc } from "@/lib/projectKnowledge";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string; name: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug, name } = await ctx.params;
  if (!getProject(slug)) return NextResponse.json({ error: "project not found" }, { status: 404 });
  try {
    const removed = deleteKnowledgeDoc(slug, decodeURIComponent(name));
    if (!removed) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
