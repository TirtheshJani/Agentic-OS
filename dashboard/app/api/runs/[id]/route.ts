import { NextResponse } from "next/server";
import { getRun, updateRun } from "@/lib/runs";
import { getIssue, updateIssue } from "@/lib/issues";
import { dropLiveRun } from "@/lib/runtime/liveRuns";
import { publish } from "@/lib/stream";
import { appendEvent } from "@/lib/threads";
import { openDb } from "@/lib/db";

openDb();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  const run = getRun(n);
  return run ? NextResponse.json(run) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  const run = getRun(n);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (run.endedAt != null) return NextResponse.json({ error: "already ended" }, { status: 409 });

  dropLiveRun(n);
  updateRun(n, { endedAt: Date.now(), exitStatus: "stopped" });
  updateIssue(run.issueId, { status: "failed" });

  const issue = getIssue(run.issueId);
  if (issue) {
    appendEvent({
      projectSlug: issue.projectSlug,
      issueId: issue.id,
      eventType: "run.stopped",
      details: `Run ${n} stopped by operator`,
    });
    publish({ kind: "issue.changed", id: issue.id, projectSlug: issue.projectSlug, reason: "status" });
    publish({ kind: "thread.appended", issueId: issue.id });
  }
  return new Response(null, { status: 204 });
}
