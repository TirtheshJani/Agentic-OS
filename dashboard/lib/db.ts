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

// V4: vault knowledge index (notes, wikilink graph, full-text search).
function applyV4(d: Database.Database): void {
  const row = d.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 4").get() as { n: number };
  if (row.n > 0) return;
  d.exec(`
CREATE TABLE IF NOT EXISTS notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT UNIQUE NOT NULL,
  basename    TEXT NOT NULL,
  title       TEXT NOT NULL,
  folder      TEXT NOT NULL,
  tags        TEXT,
  mtime       INTEGER NOT NULL,
  indexed_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_folder_idx ON notes(folder);
CREATE INDEX IF NOT EXISTS notes_basename_idx ON notes(basename);

CREATE TABLE IF NOT EXISTS note_links (
  source_id   INTEGER NOT NULL,
  target_id   INTEGER,
  target_raw  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS note_links_source_idx ON note_links(source_id);
CREATE INDEX IF NOT EXISTS note_links_target_idx ON note_links(target_id);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, body, path UNINDEXED);
`);
  d.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?)").run(Date.now());
  console.log("[db] applied schema migration v4 (notes, note_links, notes_fts)");
}

// V5: vault RAG layer (spec 0013). note_chunks is rebuilt incrementally by
// chunkSync; chunk_embeddings is keyed by content hash so it survives the
// indexer's full notes rebuild and never re-embeds unchanged content.
function applyV5(d: Database.Database): void {
  const row = d.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 5").get() as { n: number };
  if (row.n > 0) return;
  d.exec(`
CREATE TABLE IF NOT EXISTS note_chunks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  note_path    TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  heading      TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE (note_path, chunk_index)
);
CREATE INDEX IF NOT EXISTS note_chunks_path_idx ON note_chunks(note_path);
CREATE INDEX IF NOT EXISTS note_chunks_hash_idx ON note_chunks(content_hash);

CREATE TABLE IF NOT EXISTS chunk_embeddings (
  content_hash TEXT NOT NULL,
  model        TEXT NOT NULL,
  dims         INTEGER NOT NULL,
  vector       BLOB NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (content_hash, model)
);
`);
  d.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?)").run(Date.now());
  console.log("[db] applied schema migration v5 (note_chunks, chunk_embeddings)");
}

// V6: LightRAG auto-ingest dedupe log (spec 0016).
function applyV6(d: Database.Database): void {
  const row = d.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 6").get() as { n: number };
  if (row.n > 0) return;
  d.exec(`
CREATE TABLE IF NOT EXISTS lightrag_ingest_log (
  run_id      INTEGER PRIMARY KEY,
  ingested_at INTEGER NOT NULL,
  status      TEXT NOT NULL
);
`);
  d.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (6, ?)").run(Date.now());
  console.log("[db] applied schema migration v6 (lightrag_ingest_log)");
}

// V7: CLI session index (spec 0018). Summary stats per transcript file;
// message bodies are parsed on demand from the file, never stored.
function applyV7(d: Database.Database): void {
  const row = d.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 7").get() as { n: number };
  if (row.n > 0) return;
  d.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  provider        TEXT NOT NULL,
  session_id      TEXT NOT NULL,
  file_path       TEXT UNIQUE NOT NULL,
  project_dir     TEXT,
  project_slug    TEXT,
  run_id          INTEGER,
  started_at      INTEGER,
  ended_at        INTEGER,
  turns_user      INTEGER NOT NULL DEFAULT 0,
  turns_assistant INTEGER NOT NULL DEFAULT 0,
  tool_calls      INTEGER NOT NULL DEFAULT 0,
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  tokens_cache_write INTEGER,
  tokens_cache_read  INTEGER,
  models          TEXT,
  cost_estimate   REAL,
  file_mtime      INTEGER NOT NULL,
  file_size       INTEGER NOT NULL,
  indexed_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_provider_idx ON sessions(provider, started_at DESC);
CREATE INDEX IF NOT EXISTS sessions_project_idx ON sessions(project_slug, started_at DESC);
`);
  d.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (7, ?)").run(Date.now());
  console.log("[db] applied schema migration v7 (sessions)");
}

// V8: eval results (spec 0020). One metrics row and at most one judge row
// per run; re-grades replace (no history).
function applyV8(d: Database.Database): void {
  const row = d.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 8").get() as { n: number };
  if (row.n > 0) return;
  d.exec(`
CREATE TABLE IF NOT EXISTS eval_results (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id         INTEGER,
  session_path   TEXT,
  kind           TEXT NOT NULL,
  metrics        TEXT,
  rubric         TEXT,
  score          REAL,
  grade          TEXT,
  judge_provider TEXT,
  graded_at      INTEGER NOT NULL,
  UNIQUE(run_id, kind),
  UNIQUE(session_path, kind)
);
CREATE INDEX IF NOT EXISTS eval_results_run_idx ON eval_results(run_id);
`);
  d.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (8, ?)").run(Date.now());
  console.log("[db] applied schema migration v8 (eval_results)");
}

// V9: per-agent model assignment. Records the model the run was spawned
// with (null = runtime default).
function applyV9(d: Database.Database): void {
  const row = d.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 9").get() as { n: number };
  if (row.n > 0) return;
  const cols = d.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === "model")) {
    d.exec("ALTER TABLE runs ADD COLUMN model TEXT");
  }
  d.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (9, ?)").run(Date.now());
  console.log("[db] applied schema migration v9 (runs.model)");
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
  applyV4(db);
  applyV5(db);
  applyV6(db);
  applyV7(db);
  applyV8(db);
  applyV9(db);
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
