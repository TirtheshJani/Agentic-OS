import { NextResponse } from "next/server";
import { z } from "zod";
import { listRuns } from "@/lib/runs";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { startRunForIssue, StartRunError } from "@/lib/startRun";
import { ConcurrencyCapError } from "@/lib/runtime/types";

openDb();

const PostSchema = z.object({
  issueId: z.number().int().positive(),
  /** Per-run override; falls back to the agent's runtime, then the project default. */
  runtimeId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  await ensureServerBooted();

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  console.log(`[runs.POST] issueId=${parsed.data.issueId}`);
  try {
    const result = await startRunForIssue(parsed.data.issueId, { runtimeId: parsed.data.runtimeId });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ConcurrencyCapError) {
      console.log(`[runs.POST] cap hit: ${err.scope} ${err.active}/${err.cap}`);
      return NextResponse.json(
        { error: err.message, scope: err.scope, cap: err.cap, active: err.active },
        { status: 429 }
      );
    }
    if (err instanceof StartRunError) {
      console.error(`[runs.POST] ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function GET(req: Request) {
  await ensureServerBooted();
  const { searchParams } = new URL(req.url);
  const issueIdParam = searchParams.get("issueId");
  if (!issueIdParam) return NextResponse.json({ error: "issueId required" }, { status: 400 });
  const issueId = parseInt(issueIdParam, 10);
  return NextResponse.json({ runs: listRuns({ issueId }) });
}
