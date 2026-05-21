import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";

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
