import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { STATE_DB_PATH } from "@/lib/paths";

let db: Database.Database | null = null;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug    TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  assignee_slug   TEXT,
  status          TEXT NOT NULL DEFAULT 'backlog',
  mode            TEXT NOT NULL DEFAULT 'async',
  priority        INTEGER NOT NULL DEFAULT 0,
  labels          TEXT,
  github_url      TEXT,
  github_number   INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS issues_project_idx ON issues(project_slug, status);

CREATE TABLE IF NOT EXISTS runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id        INTEGER NOT NULL,
  agent_slug      TEXT NOT NULL,
  runtime_id      TEXT NOT NULL,
  worktree_path   TEXT NOT NULL,
  pty_session_id  TEXT,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  exit_status     TEXT,
  transcript_path TEXT,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);
CREATE INDEX IF NOT EXISTS runs_issue_idx ON runs(issue_id, started_at DESC);

CREATE TABLE IF NOT EXISTS hook_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          INTEGER,
  session_id      TEXT,
  event_type      TEXT NOT NULL,
  payload         TEXT NOT NULL,
  received_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_kv (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  updated_at      INTEGER NOT NULL
);
`;

// V3 (V2 was a file-layout migration, no DB change): issue handoff chains and
// in-dashboard scheduler state.
function applyV3(d: Database.Database): void {
  const row = d.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 3").get() as { n: number };
  if (row.n > 0) return;
  const cols = d.prepare("PRAGMA table_info(issues)").all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === "parent_issue_id")) {
    d.exec("ALTER TABLE issues ADD COLUMN parent_issue_id INTEGER");
  }
  d.exec(`
CREATE TABLE IF NOT EXISTS schedule_state (
  file          TEXT PRIMARY KEY,
  last_run_at   INTEGER NOT NULL,
  last_status   TEXT,
  last_issue_id INTEGER
);`);
  d.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)").run(Date.now());
  console.log("[db] applied schema migration v3 (parent_issue_id, schedule_state)");
}

export function openDb(dbPath: string = STATE_DB_PATH): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_V1);
  const row = db.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 1").get() as { n: number };
  if (row.n === 0) {
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)").run(Date.now());
  }
  applyV3(db);
  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error("DB not opened; call openDb() first");
  return db;
}

export function getMigrationVersion(): number {
  const d = getDb();
  const row = d.prepare("SELECT MAX(version) as v FROM schema_migrations").get() as { v: number | null };
  return row.v ?? 0;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
