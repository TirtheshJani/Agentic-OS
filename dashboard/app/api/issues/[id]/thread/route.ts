import { NextResponse } from "next/server";
import { z } from "zod";
import { getIssue } from "@/lib/issues";
import { appendComment, readThread } from "@/lib/threads";
import { openDb } from "@/lib/db";
import { publish } from "@/lib/stream";

openDb();

const PostSchema = z.object({
  text: z.string().min(1),
  author: z.string().default("operator"),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const issue = getIssue(n);
  if (!issue) return NextResponse.json({ error: "not found" }, { status: 404 });
  const entries = readThread(issue.projectSlug, issue.id);
  return NextResponse.json({ entries });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  if (Number.isNaN(n)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const issue = getIssue(n);
  if (!issue) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  appendComment({
    projectSlug: issue.projectSlug,
    issueId: issue.id,
    author: parsed.data.author,
    text: parsed.data.text,
  });
  publish({ kind: "thread.appended", issueId: issue.id });
  return new Response(null, { status: 201 });
}
