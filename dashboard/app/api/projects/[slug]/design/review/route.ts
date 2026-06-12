import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getProject } from "@/lib/projects";
import { listCanvases, designDirAbs } from "@/lib/design/canvases";
import { designReviewIssue } from "@/lib/issueTemplates";
import { createIssue } from "@/lib/issues";
import { publish } from "@/lib/stream";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const template = designReviewIssue({
    slug,
    designDirAbs: designDirAbs(slug).replace(/\\/g, "/"),
    canvasNames: listCanvases(slug).map((c) => c.name),
  });
  const issueId = createIssue({
    projectSlug: slug,
    title: template.title,
    body: template.body,
    status: "backlog",
    labels: template.labels,
  });
  publish({ kind: "issue.changed", id: issueId, projectSlug: slug, reason: "create" });
  return NextResponse.json({ issueId }, { status: 201 });
}
