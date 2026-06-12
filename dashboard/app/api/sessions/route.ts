import { NextResponse } from "next/server";
import { openDb, getDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { scanSessions } from "@/lib/sessions/scanner";
import { publish } from "@/lib/stream";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureServerBooted();
  openDb();
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  const project = searchParams.get("project");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];
  if (provider) {
    clauses.push("provider = ?");
    params.push(provider);
  }
  if (project) {
    clauses.push("project_slug = ?");
    params.push(project);
  }
  const rows = getDb()
    .prepare(
      `SELECT id, provider, session_id AS sessionId, project_dir AS projectDir, project_slug AS projectSlug,
              run_id AS runId, started_at AS startedAt, ended_at AS endedAt,
              turns_user AS turnsUser, turns_assistant AS turnsAssistant, tool_calls AS toolCalls,
              tokens_in AS tokensIn, tokens_out AS tokensOut, cost_estimate AS costEstimate
       FROM sessions WHERE ${clauses.join(" AND ")}
       ORDER BY started_at DESC NULLS LAST LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
  const total = (getDb().prepare(`SELECT COUNT(*) AS n FROM sessions WHERE ${clauses.join(" AND ")}`).get(...params) as {
    n: number;
  }).n;
  return NextResponse.json({ sessions: rows, total });
}

export async function POST() {
  await ensureServerBooted();
  openDb();
  const stats = scanSessions();
  publish({ kind: "sessions.indexed", scanned: stats.scanned, updated: stats.updated });
  return NextResponse.json(stats);
}
