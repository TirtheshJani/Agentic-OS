import { getDb } from "@/lib/db";
import { teamByPath } from "@/lib/teams";

export const dynamic = "force-dynamic";

type LogBody = {
  event?: "start" | "stop";
  sessionId?: string;
  cwd?: string;
  source?: string;
  transcriptPath?: string;
  prompt?: string;
};

// Accepts events from the global ~/.claude/settings.json SessionStart/Stop
// hooks. Stamps each external session as a row in `runs` so it shows up next
// to dashboard-spawned runs.
export async function POST(req: Request) {
  let body: LogBody;
  try {
    body = (await req.json()) as LogBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }
  const db = getDb();
  const event = body.event ?? "start";

  if (event === "start") {
    const existing = db
      .prepare(`SELECT id FROM runs WHERE session_id = ? LIMIT 1`)
      .get(body.sessionId) as { id: number } | undefined;
    if (existing) {
      // already logged — ignore duplicate SessionStart
      return Response.json({ ok: true, runId: existing.id, duplicate: true });
    }
    const team = body.cwd ? teamByPath(body.cwd) : null;
    const stmt = db.prepare(
      `INSERT INTO runs
         (skill_slug, prompt, status, started_at, project_slug, cwd, source, session_id)
       VALUES (?, ?, 'running', ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      "(session)",
      body.prompt ?? "(external session)",
      Date.now(),
      team?.slug ?? null,
      body.cwd ?? null,
      body.source ?? "external",
      body.sessionId
    );
    return Response.json({ ok: true, runId: Number(info.lastInsertRowid) });
  }

  if (event === "stop") {
    const row = db
      .prepare(
        `SELECT id, started_at FROM runs WHERE session_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(body.sessionId) as { id: number; started_at: number } | undefined;
    if (!row) {
      return Response.json({ error: "session not found" }, { status: 404 });
    }
    const ended = Date.now();
    db.prepare(
      `UPDATE runs SET status = 'done', ended_at = ?, duration_ms = ? WHERE id = ?`
    ).run(ended, ended - row.started_at, row.id);
    return Response.json({ ok: true, runId: row.id });
  }

  return Response.json({ error: "unknown event" }, { status: 400 });
}
