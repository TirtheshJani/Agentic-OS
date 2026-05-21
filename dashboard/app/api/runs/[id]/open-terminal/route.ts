import { NextResponse } from "next/server";
import { getRun } from "@/lib/runs";
import { getRuntime } from "@/lib/runtime/registry";
import { openExternalTerminal } from "@/lib/terminal/openExternal";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";

openDb();

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureServerBooted();
  const { id } = await params;
  const n = parseInt(id, 10);
  const run = getRun(n);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
  if (!run.ptySessionId) return NextResponse.json({ error: "session_id not yet captured" }, { status: 409 });

  const runtime = getRuntime(run.runtimeId);
  if (!runtime) return NextResponse.json({ error: "runtime not registered" }, { status: 500 });

  const command = runtime.formatResumeCommand(run.ptySessionId);
  const result = openExternalTerminal({ cwd: run.worktreePath, command });

  return result.ok
    ? new Response(null, { status: 204 })
    : NextResponse.json({ error: result.error }, { status: 500 });
}
