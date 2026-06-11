import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getProject } from "@/lib/projects";
import { writeInstructions } from "@/lib/projectKnowledge";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug } = await ctx.params;
  if (!getProject(slug)) return NextResponse.json({ error: "project not found" }, { status: 404 });
  let body: { content?: string };
  try {
    body = (await req.json()) as { content?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  try {
    writeInstructions(slug, body.content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
