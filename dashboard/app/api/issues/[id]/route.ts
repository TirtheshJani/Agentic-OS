import { NextResponse } from "next/server";
import { z } from "zod";
import { getIssue, updateIssue, deleteIssue, VALID_STATUSES, VALID_MODES, type IssueStatus, type IssueMode } from "@/lib/issues";
import { openDb } from "@/lib/db";
import { publish } from "@/lib/stream";
import { getProject } from "@/lib/projects";
import { isGitHubRepo, closeGitHubIssue } from "@/lib/github";
import { appendEvent } from "@/lib/threads";

openDb();

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  assigneeSlug: z.string().nullable().optional(),
  status: z.enum(VALID_STATUSES as [IssueStatus, ...IssueStatus[]]).optional(),
  mode: z.enum(VALID_MODES as [IssueMode, ...IssueMode[]]).optional(),
  priority: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const issue = getIssue(n);
  return issue
    ? NextResponse.json(issue)
    : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const before = getIssue(n);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  const after = updateIssue(n, parsed.data);
  const reason = parsed.data.status && parsed.data.status !== before.status ? "status" : "update";
  publish({ kind: "issue.changed", id: n, projectSlug: before.projectSlug, reason });

  // Opt-in write-back: when a GitHub-linked issue is moved to done and its
  // project enables write-back, close the upstream issue. Failures are logged to
  // the thread, never silently swallowed.
  if (
    parsed.data.status === "done" &&
    before.status !== "done" &&
    before.githubNumber != null
  ) {
    const project = getProject(before.projectSlug);
    if (project?.["github-sync"] === "write-back" && isGitHubRepo(project.repo)) {
      const ok = closeGitHubIssue(project.repo!, before.githubNumber);
      appendEvent({
        projectSlug: before.projectSlug,
        issueId: n,
        eventType: ok ? "github.closed" : "github.writeback_failed",
        details: ok
          ? `Closed GitHub issue #${before.githubNumber} via write-back.`
          : `Write-back failed: could not close GitHub issue #${before.githubNumber}. Check gh auth and repo access.`,
      });
    }
  }

  return NextResponse.json(after);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const before = getIssue(n);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  deleteIssue(n);
  publish({ kind: "issue.changed", id: n, projectSlug: before.projectSlug, reason: "delete" });
  return new Response(null, { status: 204 });
}
