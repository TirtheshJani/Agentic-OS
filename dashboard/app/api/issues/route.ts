import { NextResponse } from "next/server";
import { z } from "zod";
import { listIssues, createIssue, type IssueStatus, type IssueMode, VALID_STATUSES, VALID_MODES } from "@/lib/issues";
import { openDb } from "@/lib/db";
import { publish } from "@/lib/stream";

openDb(); // initializes the singleton if not already

const CreateSchema = z.object({
  projectSlug: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  assigneeSlug: z.string().nullable().optional(),
  mode: z.enum(VALID_MODES as [IssueMode, ...IssueMode[]]).optional(),
  priority: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
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
  const id = createIssue(parsed.data);
  publish({ kind: "issue.changed", id, projectSlug: parsed.data.projectSlug, reason: "create" });
  return NextResponse.json({ id }, { status: 201 });
}
