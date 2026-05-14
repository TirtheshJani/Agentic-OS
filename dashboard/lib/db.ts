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
}

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
}): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO runs (skill_slug, prompt, status, started_at, project_slug, cwd, agent, mcp_server)
     VALUES (?, ?, 'running', ?, ?, ?, ?, ?)`
  );
  return Number(
    stmt.run(
      opts.skillSlug,
      opts.prompt,
      Date.now(),
      opts.projectSlug ?? null,
      opts.cwd ?? null,
      opts.agent ?? null,
      opts.mcpServer ?? null
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

export function recordVaultChange(p: string, kind: "add" | "change" | "unlink") {
  getDb()
    .prepare(`INSERT INTO vault_changes (path, kind, ts) VALUES (?, ?, ?)`)
    .run(p, kind, Date.now());
}

export type TaskStatus = "queued" | "claimed" | "running" | "done" | "failed";

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
};
