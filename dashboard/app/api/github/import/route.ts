import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getProject } from "@/lib/projects";
import { isGitHubRepo } from "@/lib/github";
import { importIssues } from "@/lib/githubSync";
import { listIssues } from "@/lib/issues";
import { publish } from "@/lib/stream";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ projectSlug: z.string().min(1) });

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { projectSlug } = parsed.data;
  const project = getProject(projectSlug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  if (!isGitHubRepo(project.repo)) {
    return NextResponse.json({ error: "project has no GitHub repo-url" }, { status: 400 });
  }

  const result = importIssues(projectSlug, project.repo!);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // One board refresh signal; the board reloads its issue list on issue.changed.
  if (result.imported + result.updated > 0) {
    publish({ kind: "issue.changed", id: 0, projectSlug, reason: "update" });
  }

  return NextResponse.json({
    ...result,
    total: listIssues({ projectSlug }).length,
  });
}
