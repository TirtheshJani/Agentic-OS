import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getProject } from "@/lib/projects";
import {
  listKnowledgeDocs,
  saveKnowledgeDoc,
  readInstructions,
  listOutputs,
} from "@/lib/projectKnowledge";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug } = await ctx.params;
  if (!getProject(slug)) return NextResponse.json({ error: "project not found" }, { status: 404 });
  try {
    const instructions = readInstructions(slug);
    return NextResponse.json({
      docs: listKnowledgeDocs(slug),
      instructions: { exists: instructions.length > 0, content: instructions },
      outputs: listOutputs(slug),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug } = await ctx.params;
  if (!getProject(slug)) return NextResponse.json({ error: "project not found" }, { status: 404 });
  let body: { name?: string; content?: string };
  try {
    body = (await req.json()) as { name?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.name || typeof body.content !== "string") {
    return NextResponse.json({ error: "name and content are required" }, { status: 400 });
  }
  try {
    const relPath = saveKnowledgeDoc(slug, body.name, body.content);
    return NextResponse.json({ relPath }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
