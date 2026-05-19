import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { dbPath } from "./paths";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_slug TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_ms INTEGER,
      output_path TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at DESC);

    CREATE TABLE IF NOT EXISTS vault_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vault_ts ON vault_changes(ts DESC);

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_slug TEXT NOT NULL,
      cron TEXT NOT NULL,
      next_run_at INTEGER,
      source TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      assignee TEXT NOT NULL,
      department TEXT,
      parent_task_id INTEGER REFERENCES tasks(id),
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      run_id INTEGER REFERENCES runs(id),
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, assignee);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
  `);

  addColumnIfMissing(db, "runs", "project_slug", "TEXT");
  addColumnIfMissing(db, "runs", "cwd", "TEXT");
  addColumnIfMissing(db, "runs", "agent", "TEXT");
  addColumnIfMissing(db, "runs", "mcp_server", "TEXT");
  addColumnIfMissing(db, "runs", "tokens_in", "INTEGER");
  addColumnIfMissing(db, "runs", "tokens_out", "INTEGER");
  addColumnIfMissing(db, "runs", "tokens_cache_read", "INTEGER");
  addColumnIfMissing(db, "runs", "tokens_cache_create", "INTEGER");
  addColumnIfMissing(db, "runs", "cost_usd", "REAL");
  addColumnIfMissing(db, "runs", "task_id", "INTEGER REFERENCES tasks(id)");
  // For external Claude Code sessions (started outside the dashboard) that
  // report in via the global SessionStart/Stop hook.
  addColumnIfMissing(db, "runs", "session_id", "TEXT");
  addColumnIfMissing(db, "runs", "source", "TEXT");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);`);

  // Phase 7.3 + 8.1: project linkage and issue-board fields on tasks.
  // All nullable so existing rows stay valid.
  addColumnIfMissing(db, "tasks", "project_slug", "TEXT");
  addColumnIfMissing(db, "tasks", "title", "TEXT");
  addColumnIfMissing(db, "tasks", "repo", "TEXT");
  addColumnIfMissing(db, "tasks", "priority", "TEXT");
  // labels stored as JSON-encoded string array in a TEXT column (no join table).
  addColumnIfMissing(db, "tasks", "labels", "TEXT");
  addColumnIfMissing(db, "tasks", "github_url", "TEXT");
  addColumnIfMissing(db, "tasks", "github_number", "INTEGER");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_slug, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_github ON tasks(repo, github_number);
  `);
}

// SQLite cannot parameterize DDL (PRAGMA, ALTER TABLE) — table/column/type
// must be interpolated. Only ever called with hardcoded literals from migrate().
// Never expose this helper to user input.
function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  type: string
) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (rows.some((r) => r.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

export type RunRow = {
  id: number;
  skill_slug: string;
  prompt: string;
  status: "queued" | "running" | "done" | "error";
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  output_path: string | null;
  error: string | null;
  project_slug: string | null;
  cwd: string | null;
  agent: string | null;
  mcp_server: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_cache_read: number | null;
  tokens_cache_create: number | null;
  cost_usd: number | null;
  task_id: number | null;
};

export type RunUsage = {
  tokens_in?: number;
  tokens_out?: number;
  tokens_cache_read?: number;
  tokens_cache_create?: number;
  cost_usd?: number;
};

export type VaultChangeRow = {
  id: number;
  path: string;
  kind: "add" | "change" | "unlink";
  ts: number;
};

export function insertRun(opts: {
  skillSlug: string;
  prompt: string;
  projectSlug?: string | null;
  cwd?: string | null;
  agent?: string | null;
  mcpServer?: string | null;
  // Phase 8.4: 'terminal' marks rows spawned via claude-launcher in
  // interactive mode. Stays null/unset for headless dashboard runs (which
  // are implicitly 'dashboard'); the session-log hook uses its own values
  // ('external', or whatever the hook payload carries).
  source?: string | null;
  taskId?: number | null;
}): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO runs (skill_slug, prompt, status, started_at, project_slug, cwd, agent, mcp_server, source, task_id)
     VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?, ?)`
  );
  return Number(
    stmt.run(
      opts.skillSlug,
      opts.prompt,
      Date.now(),
      opts.projectSlug ?? null,
      opts.cwd ?? null,
      opts.agent ?? null,
      opts.mcpServer ?? null,
      opts.source ?? null,
      opts.taskId ?? null
    ).lastInsertRowid
  );
}

export function finishRun(
  id: number,
  status: "done" | "error",
  outputPath: string | null,
  error: string | null,
  usage?: RunUsage
) {
  const db = getDb();
  const ended = Date.now();
  const row = db.prepare(`SELECT started_at FROM runs WHERE id = ?`).get(id) as
    | { started_at: number }
    | undefined;
  const duration = row ? ended - row.started_at : null;
  db.prepare(
    `UPDATE runs SET status = ?, ended_at = ?, duration_ms = ?, output_path = ?, error = ?,
       tokens_in = COALESCE(?, tokens_in),
       tokens_out = COALESCE(?, tokens_out),
       tokens_cache_read = COALESCE(?, tokens_cache_read),
       tokens_cache_create = COALESCE(?, tokens_cache_create),
       cost_usd = COALESCE(?, cost_usd)
     WHERE id = ?`
  ).run(
    status,
    ended,
    duration,
    outputPath,
    error,
    usage?.tokens_in ?? null,
    usage?.tokens_out ?? null,
    usage?.tokens_cache_read ?? null,
    usage?.tokens_cache_create ?? null,
    usage?.cost_usd ?? null,
    id
  );
}

export function updateRunUsage(id: number, usage: RunUsage) {
  if (!usage) return;
  const db = getDb();
  db.prepare(
    `UPDATE runs SET
       tokens_in = COALESCE(?, tokens_in),
       tokens_out = COALESCE(?, tokens_out),
       tokens_cache_read = COALESCE(?, tokens_cache_read),
       tokens_cache_create = COALESCE(?, tokens_cache_create),
       cost_usd = COALESCE(?, cost_usd)
     WHERE id = ?`
  ).run(
    usage.tokens_in ?? null,
    usage.tokens_out ?? null,
    usage.tokens_cache_read ?? null,
    usage.tokens_cache_create ?? null,
    usage.cost_usd ?? null,
    id
  );
}

export function recentRuns(limit = 8): RunRow[] {
  return getDb()
    .prepare(`SELECT * FROM runs ORDER BY started_at DESC LIMIT ?`)
    .all(limit) as RunRow[];
}

export function recentVaultChanges(limit = 8): VaultChangeRow[] {
  return getDb()
    .prepare(`SELECT * FROM vault_changes ORDER BY ts DESC LIMIT ?`)
    .all(limit) as VaultChangeRow[];
}

// Runs whose underlying task has the given project_slug. Used by the
// project detail page (phase 7.4) to scope the recent-runs list to one
// project. Joins runs -> tasks; runs with no task_id are excluded.
export function recentRunsByProject(slug: string, limit: number): RunRow[] {
  const capped = Math.min(Math.max(limit, 1), 500);
  return getDb()
    .prepare(
      `SELECT runs.* FROM runs
         JOIN tasks ON runs.task_id = tasks.id
        WHERE tasks.project_slug = ?
        ORDER BY runs.started_at DESC
        LIMIT ?`
    )
    .all(slug, capped) as RunRow[];
}

// Vault changes whose path starts with any of the given prefixes. Used by
// the project detail page (phase 7.4) to surface writes inside either
// `vault/projects/<slug>/` or the project's working-tree path. The LIKE
// pattern is built by escaping `%` and `_` in the prefix and appending
// `%`, so we never inject user-controlled wildcards. Empty prefixes
// return [] without hitting the db.
export function recentVaultChangesByPathPrefix(
  prefixes: string[],
  limit: number
): VaultChangeRow[] {
  const cleaned = prefixes
    .filter((p) => typeof p === "string" && p.length > 0)
    .map((p) => (p.endsWith("/") ? p : p + "/"));
  if (cleaned.length === 0) return [];
  const capped = Math.min(Math.max(limit, 1), 500);
  const patterns = cleaned.map((p) => escapeLikePrefix(p) + "%");
  const placeholders = patterns.map(() => "path LIKE ? ESCAPE '\\'").join(" OR ");
  return getDb()
    .prepare(
      `SELECT * FROM vault_changes
        WHERE ${placeholders}
        ORDER BY ts DESC
        LIMIT ?`
    )
    .all(...patterns, capped) as VaultChangeRow[];
}

// Escape SQL LIKE wildcards (`%`, `_`) and the escape char itself so a
// path that happens to contain `_` or `%` does not match unintended rows.
// Pair with `ESCAPE '\\'` in the LIKE clause.
function escapeLikePrefix(prefix: string): string {
  return prefix.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function recordVaultChange(p: string, kind: "add" | "change" | "unlink") {
  getDb()
    .prepare(`INSERT INTO vault_changes (path, kind, ts) VALUES (?, ?, ?)`)
    .run(p, kind, Date.now());
}

export type TaskStatus =
  | "backlog"
  | "queued"
  | "claimed"
  | "running"
  | "review"
  | "done"
  | "failed";

export type TaskPriority = "low" | "med" | "high" | "urgent";

export type TaskRow = {
  id: number;
  prompt: string;
  assignee: string;
  department: string | null;
  parent_task_id: number | null;
  status: TaskStatus;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  run_id: number | null;
  error: string | null;
  project_slug: string | null;
  title: string | null;
  repo: string | null;
  priority: TaskPriority | null;
  // JSON-encoded string array (e.g. '["bug","p1"]'); null when no labels.
  labels: string | null;
  github_url: string | null;
  github_number: number | null;
};
