import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getProject } from "@/lib/projects";
import { getResearchProject, researchDirAbs } from "@/lib/research/projects";
import { researchCollectionIssue } from "@/lib/issueTemplates";
import { createIssue } from "@/lib/issues";
import { getSettings } from "@/lib/settings";
import { publish } from "@/lib/stream";

export const dynamic = "force-dynamic";

const DEFAULT_PROJECT_SLUG = "research";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug } = await params;
  const research = getResearchProject(slug);
  if (!research) return NextResponse.json({ error: "research project not found" }, { status: 404 });

  let body: { sourceHints?: string; projectSlug?: string; agentSlug?: string };
  try {
    body = (await req.json()) as { sourceHints?: string; projectSlug?: string; agentSlug?: string };
  } catch {
    body = {};
  }

  const projectSlug = body.projectSlug || DEFAULT_PROJECT_SLUG;
  if (!getProject(projectSlug)) {
    return NextResponse.json(
      {
        error: `dashboard project "${projectSlug}" not found`,
        setup: [
          `Collection runs as an agent run against a real dashboard project (default "${projectSlug}").`,
          `Create one once: a small scratch repo linked via /new or /projects, slug "${projectSlug}", with a research-capable agent in its crew.`,
        ],
      },
      { status: 409 }
    );
  }

  const template = researchCollectionIssue({
    slug,
    question: research.question || research.title,
    sourceHints: body.sourceHints,
    vaultDirAbs: researchDirAbs(slug).replace(/\\/g, "/"),
  });
  const issueId = createIssue({
    projectSlug,
    title: template.title,
    body: template.body,
    assigneeSlug: body.agentSlug || undefined,
    status: getSettings().autonomy.enabled ? "queued" : "backlog",
    labels: template.labels,
  });
  publish({ kind: "issue.changed", id: issueId, projectSlug, reason: "create" });
  return NextResponse.json({ issueId }, { status: 201 });
}
