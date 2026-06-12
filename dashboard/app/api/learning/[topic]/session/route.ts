import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getTopic, learningDirAbs, ensureLearningProject, LEARNING_PROJECT_SLUG } from "@/lib/learning/topics";
import { learningSessionIssue } from "@/lib/issueTemplates";
import { createIssue } from "@/lib/issues";
import { publish } from "@/lib/stream";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ topic: string }> }) {
  await ensureServerBooted();
  openDb();
  const { topic } = await params;
  const t = getTopic(topic);
  if (!t) return NextResponse.json({ error: "learning topic not found" }, { status: 404 });

  let body: { kind?: "tutor" | "srs-review" };
  try {
    body = (await req.json()) as { kind?: "tutor" | "srs-review" };
  } catch {
    body = {};
  }
  const kind = body.kind === "srs-review" ? "srs-review" : "tutor";
  if (kind === "srs-review" && !t.hasSrs) {
    return NextResponse.json({ error: "this topic has no srs.md yet" }, { status: 400 });
  }
  if (!t.tutorSlug) return NextResponse.json({ error: "syllabus has no tutor: frontmatter" }, { status: 400 });

  try {
    ensureLearningProject();
  } catch (err) {
    return NextResponse.json({ error: `learning project setup failed: ${(err as Error).message}` }, { status: 500 });
  }

  const template = learningSessionIssue({
    topic,
    tutorSlug: t.tutorSlug,
    syllabusExcerpt: t.syllabus.slice(0, 2000),
    vaultDirAbs: learningDirAbs(topic).replace(/\\/g, "/"),
    kind,
  });
  const issueId = createIssue({
    projectSlug: LEARNING_PROJECT_SLUG,
    title: template.title,
    body: template.body,
    assigneeSlug: t.tutorSlug,
    status: "queued",
    // "sync": the operator sits at the terminal for the whole session.
    mode: "sync",
    labels: template.labels,
  });
  publish({ kind: "issue.changed", id: issueId, projectSlug: LEARNING_PROJECT_SLUG, reason: "create" });
  return NextResponse.json({ issueId }, { status: 201 });
}
