import { NextResponse } from "next/server";
import { getProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    slug: project.slug,
    name: project.name,
    path: project.path,
    repo: project.repo ?? null,
    crew: project.crew,
    capabilities: project.capabilities,
    runtimeDefault: project["runtime-default"],
    bodyMarkdown: project.bodyMarkdown,
    lastModified: project.lastModified,
  });
}
