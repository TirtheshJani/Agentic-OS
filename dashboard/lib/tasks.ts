import { getDb, type RunRow, type TaskPriority, type TaskRow, type TaskStatus } from "./db";

export type CreateTaskInput = {
  prompt: string;
  assignee: string;
  department?: string | null;
  parentTaskId?: number | null;
  projectSlug?: string | null;
  title?: string | null;
  repo?: string | null;
  priority?: TaskPriority | null;
  labels?: string[] | null;
  githubUrl?: string | null;
  githubNumber?: number | null;
  // Phase 8.2: callers can file a task directly into the backlog (issues UI)
  // instead of the default 'queued' state that auto-spawns a run. Only
  // 'backlog' and 'queued' are accepted here; other initial states are
  // illegal and silently coerced to 'queued'.
  status?: "queued" | "backlog" | null;
};

export function createTask(input: CreateTaskInput): number {
  const db = getDb();
  // Title fallback policy: if title is missing/empty we store NULL rather than
  // auto-computing the first 60 chars of `prompt`. This preserves the
  // "filed without title" signal so display callers (board cards, etc.) can
  // derive a fallback at read time per roadmap 8.1.
  const title =
    typeof input.title === "string" && input.title.trim().length > 0
      ? input.title
      : null;
  const labels =
    Array.isArray(input.labels) && input.labels.length > 0
      ? JSON.stringify(input.labels)
      : null;
  const initialStatus: TaskStatus = input.status === "backlog" ? "backlog" : "queued";
  const stmt = db.prepare(
    `INSERT INTO tasks (
       prompt, assignee, department, parent_task_id, status, created_at,
       project_slug, title, repo, priority, labels, github_url, github_number
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  return Number(
    stmt.run(
      input.prompt,
      input.assignee,
      input.department ?? null,
      input.parentTaskId ?? null,
      initialStatus,
      Date.now(),
      input.projectSlug ?? null,
      title,
      input.repo ?? null,
      input.priority ?? null,
      labels,
      input.githubUrl ?? null,
      input.githubNumber ?? null
    ).lastInsertRowid
  );
}

export function getTask(id: number): TaskRow | null {
  const db = getDb();
  return (db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined) ?? null;
}

export function listTasks(opts: {
  assignee?: string;
  department?: string;
  status?: TaskStatus;
  projectSlug?: string;
  limit?: number;
} = {}): TaskRow[] {
  const db = getDb();
  const conds: string[] = [];
  const args: unknown[] = [];
  if (opts.assignee) { conds.push("assignee = ?"); args.push(opts.assignee); }
  if (opts.department) { conds.push("department = ?"); args.push(opts.department); }
  if (opts.status) { conds.push("status = ?"); args.push(opts.status); }
  if (opts.projectSlug) { conds.push("project_slug = ?"); args.push(opts.projectSlug); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  args.push(limit);
  return db
    .prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...args) as TaskRow[];
}

export function claimTask(id: number, newAssignee: string): TaskRow | null {
  const db = getDb();
  const tx = db.transaction((id: number, assignee: string) => {
    const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined;
    if (!row) return null;
    if (row.status !== "queued") {
      throw new Error(`task ${id} not in queued state (current: ${row.status})`);
    }
    db.prepare(
      `UPDATE tasks SET assignee = ?, status = 'claimed' WHERE id = ?`
    ).run(assignee, id);
    return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow;
  });
  return tx(id, newAssignee);
}

export function startTask(id: number, runId: number): TaskRow | null {
  const db = getDb();
  const tx = db.transaction((id: number, runId: number) => {
    const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined;
    if (!row) return null;
    if (row.status !== "claimed" && row.status !== "queued") {
      throw new Error(`task ${id} not startable (current: ${row.status})`);
    }
    db.prepare(
      `UPDATE tasks SET status = 'running', started_at = ?, run_id = ? WHERE id = ?`
    ).run(Date.now(), runId, id);
    db.prepare(`UPDATE runs SET task_id = ? WHERE id = ?`).run(id, runId);
    return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow;
  });
  return tx(id, runId);
}

export function finishTask(
  id: number,
  status: "done" | "failed",
  error: string | null = null
): TaskRow | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined;
  if (!row) return null;
  db.prepare(
    `UPDATE tasks SET status = ?, finished_at = ?, error = ? WHERE id = ?`
  ).run(status, Date.now(), error, id);
  return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow;
}

export function childrenOf(id: number): TaskRow[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC`)
    .all(id) as TaskRow[];
}

// Phase 8.2: legal state transitions for the manual status-override endpoint
// (used by the issues UI). Keep this table the single source of truth — the
// claim/start/finish endpoints retain their own narrower checks for legacy
// protocol callers, but new code should route through `transitionTask`.
//
// Allowed moves:
//   backlog → queued | failed
//   queued  → claimed | running | failed
//   claimed → running | queued | failed
//   running → review | done | failed
//   review  → done | running | failed
//   done    → review            (re-open)
//   failed  → backlog | queued  (retry / triage)
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  backlog: ["queued", "failed"],
  queued: ["claimed", "running", "failed"],
  claimed: ["running", "queued", "failed"],
  running: ["review", "done", "failed"],
  review: ["done", "running", "failed"],
  done: ["review"],
  failed: ["backlog", "queued"],
};

export function isLegalTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionTask(id: number, newStatus: TaskStatus): TaskRow | null {
  const db = getDb();
  const tx = db.transaction((id: number, next: TaskStatus) => {
    const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined;
    if (!row) return null;
    if (!isLegalTransition(row.status, next)) {
      throw new Error(
        `illegal transition for task ${id}: ${row.status} -> ${next}`
      );
    }
    // Terminal stamps: any move into done/failed records finished_at. We do
    // NOT touch started_at here — that's owned by startTask when a run
    // begins. A backlog -> queued move with no run yet leaves started_at
    // null until the spawned run lands a startTask call.
    if (next === "done" || next === "failed") {
      db.prepare(
        `UPDATE tasks SET status = ?, finished_at = ? WHERE id = ?`
      ).run(next, Date.now(), id);
    } else {
      db.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).run(next, id);
    }
    return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow;
  });
  return tx(id, newStatus);
}

// Runs linked to a given task via runs.task_id. Used by the issue detail
// page for the per-task run history rail.
export function runsForTask(taskId: number, limit = 25): RunRow[] {
  const capped = Math.min(Math.max(limit, 1), 200);
  return getDb()
    .prepare(
      `SELECT * FROM runs WHERE task_id = ? ORDER BY started_at DESC LIMIT ?`
    )
    .all(taskId, capped) as RunRow[];
}
