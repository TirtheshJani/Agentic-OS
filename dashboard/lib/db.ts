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
};

export type VaultChangeRow = {
  id: number;
  path: string;
  kind: "add" | "change" | "unlink";
  ts: number;
};

export function insertRun(skillSlug: string, prompt: string): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO runs (skill_slug, prompt, status, started_at) VALUES (?, ?, 'running', ?)`
  );
  return Number(stmt.run(skillSlug, prompt, Date.now()).lastInsertRowid);
}

export function finishRun(
  id: number,
  status: "done" | "error",
  outputPath: string | null,
  error: string | null
) {
  const db = getDb();
  const ended = Date.now();
  const row = db.prepare(`SELECT started_at FROM runs WHERE id = ?`).get(id) as
    | { started_at: number }
    | undefined;
  const duration = row ? ended - row.started_at : null;
  db.prepare(
    `UPDATE runs SET status = ?, ended_at = ?, duration_ms = ?, output_path = ?, error = ? WHERE id = ?`
  ).run(status, ended, duration, outputPath, error, id);
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
