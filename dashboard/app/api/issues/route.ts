import { NextResponse } from "next/server";
import { z } from "zod";
import { listIssues, createIssue, getIssue, chainDepth, type IssueStatus, type IssueMode, VALID_STATUSES, VALID_MODES } from "@/lib/issues";
import { openDb } from "@/lib/db";
import { publish } from "@/lib/stream";
import { getSettings } from "@/lib/settings";
import { appendEvent } from "@/lib/threads";

openDb(); // initializes the singleton if not already

const CreateSchema = z.object({
  projectSlug: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  assigneeSlug: z.string().nullable().optional(),
  status: z.enum(VALID_STATUSES as [IssueStatus, ...IssueStatus[]]).optional(),
  mode: z.enum(VALID_MODES as [IssueMode, ...IssueMode[]]).optional(),
  priority: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
  /** Set by agent handoffs; enables chain-depth capping. */
  parentIssueId: z.number().int().positive().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectSlug = searchParams.get("projectSlug") ?? undefined;
  const status = searchParams.get("status") as IssueStatus | null;
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const items = listIssues({ projectSlug, status: status ?? undefined });
  return NextResponse.json({ issues: items });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const data = { ...parsed.data };
  let depthCapped = false;
  if (data.parentIssueId != null) {
    if (!getIssue(data.parentIssueId)) {
      return NextResponse.json({ error: `parent issue not found: ${data.parentIssueId}` }, { status: 400 });
    }
    // Handoff chains stop spawning past maxChainDepth: the child is still
    // filed, but lands in backlog for a human instead of auto-running.
    const depth = chainDepth(data.parentIssueId) + 1;
    const max = getSettings().autonomy.maxChainDepth;
    if (depth >= max && data.status === "queued") {
      data.status = "backlog";
      depthCapped = true;
    }
  }

  const id = createIssue(data);
  if (depthCapped) {
    appendEvent({
      projectSlug: data.projectSlug,
      issueId: id,
      eventType: "orchestrator.depth-capped",
      details: `Handoff chain reached maxChainDepth; filed to backlog instead of queue.`,
    });
    publish({ kind: "thread.appended", issueId: id });
  }
  publish({ kind: "issue.changed", id, projectSlug: data.projectSlug, reason: "create" });
  return NextResponse.json({ id, status: data.status ?? "backlog" }, { status: 201 });
}
