import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { listResearchProjects, createResearchProject } from "@/lib/research/projects";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureServerBooted();
  openDb();
  return NextResponse.json({ projects: listResearchProjects() });
}

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: { title?: string; question?: string; tags?: string[] };
  try {
    body = (await req.json()) as { title?: string; question?: string; tags?: string[] };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.question?.trim()) {
    return NextResponse.json({ error: "title and question are required" }, { status: 400 });
  }
  try {
    const project = createResearchProject({ title: body.title.trim(), question: body.question.trim(), tags: body.tags });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
