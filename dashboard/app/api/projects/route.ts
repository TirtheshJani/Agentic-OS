import { NextResponse } from "next/server";
import { z } from "zod";
import { listProjects } from "@/lib/projects";
import { createProjectFromExistingFolder } from "@/lib/projectMutations";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = listProjects();
    return NextResponse.json({
      projects: projects.map(p => ({
        slug: p.slug,
        name: p.name,
        path: p.path,
        repo: p.repo ?? null,
        crew: p.crew,
        capabilities: p.capabilities,
        runtimeDefault: p["runtime-default"],
        lastModified: p.lastModified,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

const PostBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("link"),
    name: z.string().min(1),
    folderPath: z.string().min(1),
    slug: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
  }),
  z.object({
    mode: z.literal("clone"),
    name: z.string().min(1),
    repoUrl: z.string().url(),
    slug: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
  }),
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.mode === "link") {
    try {
      const result = createProjectFromExistingFolder({
        name: parsed.data.name,
        folderPath: parsed.data.folderPath,
        vaultProjectsDir: VAULT_PROJECTS_DIR,
        slug: parsed.data.slug,
        capabilities: parsed.data.capabilities,
      });
      return NextResponse.json({ slug: result.slug, projectFilePath: result.projectFilePath }, { status: 201 });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  // Clone mode handled in Task 4. Return 501 for now.
  return NextResponse.json({ error: "clone mode not implemented yet" }, { status: 501 });
}
