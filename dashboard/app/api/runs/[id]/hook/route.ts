import { NextResponse } from "next/server";
import { z } from "zod";
import { getRun, updateRun } from "@/lib/runs";
import { notifyExternalSessionId } from "@/lib/runtime/liveRuns";
import { recordHookEvent } from "@/lib/hookEvents";
import { openDb } from "@/lib/db";

openDb();

const Schema = z.object({
  runId: z.number().int().positive(),
  sessionId: z.string().min(1),
  transcriptPath: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  if (parsed.data.runId !== n) return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  if (!getRun(n)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  notifyExternalSessionId(n, parsed.data.sessionId);
  if (parsed.data.transcriptPath) {
    updateRun(n, { transcriptPath: parsed.data.transcriptPath });
  }
  // Real hook event from a hook-capable runtime (claude-code SessionStart).
  recordHookEvent({
    runId: n,
    sessionId: parsed.data.sessionId,
    eventType: "SessionStart",
    payload: { synthetic: false, runtimeId: "claude-code", detail: "SessionStart hook" },
  });
  console.log(`[hook] run ${n}: session_id=${parsed.data.sessionId}, transcript=${parsed.data.transcriptPath ?? "none"}`);
  return new Response(null, { status: 204 });
}
