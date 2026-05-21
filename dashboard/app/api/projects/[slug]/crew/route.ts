import { NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";
import { updateProjectCrew } from "@/lib/projectMutations";
import { getProject } from "@/lib/projects";

const PutSchema = z.object({
  crew: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)),
});

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const projectFile = path.join(VAULT_PROJECTS_DIR, slug, "PROJECT.md");
  updateProjectCrew(projectFile, parsed.data.crew);
  return new Response(null, { status: 204 });
}
