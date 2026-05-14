import { getDb, type TaskRow, type TaskStatus } from "./db";

export type CreateTaskInput = {
  prompt: string;
  assignee: string;
  department?: string | null;
  parentTaskId?: number | null;
};

export function createTask(input: CreateTaskInput): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO tasks (prompt, assignee, department, parent_task_id, status, created_at)
     VALUES (?, ?, ?, ?, 'queued', ?)`
  );
  return Number(
    stmt.run(
      input.prompt,
      input.assignee,
      input.department ?? null,
      input.parentTaskId ?? null,
      Date.now()
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
  limit?: number;
} = {}): TaskRow[] {
  const db = getDb();
  const conds: string[] = [];
  const args: unknown[] = [];
  if (opts.assignee) { conds.push("assignee = ?"); args.push(opts.assignee); }
  if (opts.department) { conds.push("department = ?"); args.push(opts.department); }
  if (opts.status) { conds.push("status = ?"); args.push(opts.status); }
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
