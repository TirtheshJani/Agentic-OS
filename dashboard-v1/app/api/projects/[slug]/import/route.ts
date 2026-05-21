// Phase 8.5 — Project-scoped GitHub import endpoint.
//
// POST /api/projects/<slug>/import
//   - Resolves the project; 404 if missing or has no repo-url.
//   - Parses repo-url into "owner/name"; 400 on a non-github.com URL.
//   - Calls importIssues(repo, { projectSlug }) and returns the counts.
//
// importIssues catches all gh CLI failures internally and returns them
// in the `errors[]` field, so this route never crashes on a missing or
// unauthenticated gh.

import { importIssues, parseGithubRepo } from "@/lib/github-sync";
import { projectBySlug } from "@/lib/projects-loader";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const project = projectBySlug(slug);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  if (!project.repoUrl) {
    return Response.json(
      { error: "project has no repo-url; nothing to import" },
      { status: 400 }
    );
  }
  const repo = parseGithubRepo(project.repoUrl);
  if (!repo) {
    return Response.json(
      { error: `repo-url is not a recognized github.com URL: ${project.repoUrl}` },
      { status: 400 }
    );
  }
  const summary = await importIssues(repo, { projectSlug: slug });
  return Response.json({ repo, ...summary });
}
