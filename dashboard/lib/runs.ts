// dashboard/lib/runs.ts
import { getDb } from "@/lib/db";

/**
 * How a run ended. `done`/`failed` are written by `finalizeRunExit`; `stopped`
 * by an operator DELETE on a live run; `interrupted` only by boot reconciliation
 * for runs whose PTY died with a previous process (ADR-020) — kept distinct from
 * `failed` so analytics and evals do not score an environment interruption as an
 * agent failure.
 */
export type ExitStatus = "done" | "failed" | "stopped" | "interrupted";

export interface Run {
  id: number;
  issueId: number;
  agentSlug: string;
  runtimeId: string;
  model: string | null;
  worktreePath: string;
  ptySessionId: string | null;
  startedAt: number;
  endedAt: number | null;
  exitStatus: ExitStatus | null;
  transcriptPath: string | null;
}

function rowToRun(row: any): Run {
  return {
    id: row.id,
    issueId: row.issue_id,
    agentSlug: row.agent_slug,
    runtimeId: row.runtime_id,
    model: row.model ?? null,
    worktreePath: row.worktree_path,
    ptySessionId: row.pty_session_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    exitStatus: row.exit_status,
    transcriptPath: row.transcript_path,
  };
}

interface CreateOpts {
  issueId: number;
  agentSlug: string;
  runtimeId: string;
  worktreePath: string;
  model?: string;
}

export function createRun(opts: CreateOpts): number {
  const db = getDb();
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO runs (issue_id, agent_slug, runtime_id, model, worktree_path, started_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(opts.issueId, opts.agentSlug, opts.runtimeId, opts.model ?? null, opts.worktreePath, now);
  return Number(info.lastInsertRowid);
}

export function getRun(id: number): Run | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
  return row ? rowToRun(row) : null;
}

export function listRuns(opts: { issueId?: number } = {}): Run[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];
  if (opts.issueId !== undefined) {
    where.push("issue_id = ?");
    params.push(opts.issueId);
  }
  const sql = `SELECT * FROM runs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY started_at DESC`;
  return db.prepare(sql).all(...params).map(rowToRun);
}

export interface RunWithIssue extends Run {
  issueTitle: string;
  projectSlug: string;
}

/** Recent runs joined to their issue (title + project) for the activity
 * feed and the dashboard home cards. */
export function listRecentRunsWithIssues(opts: { limit?: number; activeOnly?: boolean } = {}): RunWithIssue[] {
  const db = getDb();
  const where = opts.activeOnly ? "WHERE r.ended_at IS NULL" : "";
  const rows = db.prepare(`
    SELECT r.*, i.title AS issue_title, i.project_slug AS issue_project_slug
    FROM runs r
    INNER JOIN issues i ON i.id = r.issue_id
    ${where}
    ORDER BY r.started_at DESC, r.id DESC
    LIMIT ?
  `).all(opts.limit ?? 50) as any[];
  return rows.map((row) => ({
    ...rowToRun(row),
    issueTitle: row.issue_title,
    projectSlug: row.issue_project_slug,
  }));
}

export function listActiveRuns(): Run[] {
  const db = getDb();
  return db.prepare("SELECT * FROM runs WHERE ended_at IS NULL ORDER BY started_at DESC").all().map(rowToRun);
}

export function listActiveRunsForProject(projectSlug: string): Run[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.* FROM runs r
    INNER JOIN issues i ON i.id = r.issue_id
    WHERE r.ended_at IS NULL AND i.project_slug = ?
    ORDER BY r.started_at DESC
  `).all(projectSlug).map(rowToRun);
}

interface UpdateOpts {
  endedAt?: number;
  exitStatus?: ExitStatus;
  transcriptPath?: string;
  ptySessionId?: string;
  /** Rewritten when a spawn-time runtime fallback re-targets the run (spec 0009). */
  runtimeId?: string;
  model?: string;
}

export function updateRun(id: number, patch: UpdateOpts): void {
  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const column =
      k === "endedAt" ? "ended_at" :
      k === "exitStatus" ? "exit_status" :
      k === "transcriptPath" ? "transcript_path" :
      k === "ptySessionId" ? "pty_session_id" :
      k === "runtimeId" ? "runtime_id" :
      k;
    sets.push(`${column} = ?`);
    params.push(v);
  }
  if (sets.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}

export function attachSessionId(id: number, sessionId: string): void {
  updateRun(id, { ptySessionId: sessionId });
}
