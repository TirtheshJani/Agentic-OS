import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { gradeRunMetrics, gradeRunWithJudge, ungradedRunIds } from "@/lib/evals/store";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: { runId?: number; batch?: boolean };
  try {
    body = (await req.json()) as { runId?: number; batch?: boolean };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.batch) {
    // Sequential, capped: one judge call at a time, never parallel.
    const ids = ungradedRunIds(getSettings().evals.batchLimit);
    const results: Array<{ runId: number; ok: boolean; grade?: string; error?: string }> = [];
    for (const runId of ids) {
      gradeRunMetrics(runId);
      const r = await gradeRunWithJudge(runId);
      results.push(r.ok ? { runId, ok: true, grade: r.grade } : { runId, ok: false, error: r.error });
      if (!r.ok && r.error.includes("provider is none")) break;
    }
    return NextResponse.json({ results });
  }

  if (!body.runId) return NextResponse.json({ error: "runId is required" }, { status: 400 });
  gradeRunMetrics(body.runId);
  const result = await gradeRunWithJudge(body.runId);
  if (!result.ok) {
    const status = result.error.includes("provider is none") ? 409 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
