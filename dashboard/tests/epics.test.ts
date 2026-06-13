import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, getMigrationVersion, closeDb } from "@/lib/db";

let dbPath: string;

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-epics-"));
  dbPath = path.join(tmp, "state.db");
});

afterEach(() => {
  closeDb();
  if (fs.existsSync(dbPath)) {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  }
});

describe("v10 epic data model", () => {
  it("creates the epics table", () => {
    const db = openDb(dbPath);
    const tbl = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='epics'")
      .get() as { name: string } | undefined;
    expect(tbl?.name).toBe("epics");
  });

  it("adds epic_id and depends_on columns to issues", () => {
    const db = openDb(dbPath);
    const cols = db.prepare("PRAGMA table_info(issues)").all() as Array<{ name: string }>;
    expect(cols.some(c => c.name === "epic_id")).toBe(true);
    expect(cols.some(c => c.name === "depends_on")).toBe(true);
  });

  it("is idempotent on a second boot", () => {
    openDb(dbPath);
    closeDb();
    const db2 = openDb(dbPath);
    expect(getMigrationVersion()).toBeGreaterThanOrEqual(10);
    const count = (
      db2.prepare("SELECT COUNT(*) as n FROM schema_migrations WHERE version = 10").get() as { n: number }
    ).n;
    expect(count).toBe(1);
  });

  it("loads an existing issue with the new columns defaulting to null", () => {
    const db = openDb(dbPath);
    const now = Date.now();
    db.prepare(
      "INSERT INTO issues (project_slug, title, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).run("demo", "an issue", now, now);
    const issue = db
      .prepare("SELECT epic_id, depends_on FROM issues WHERE title = ?")
      .get("an issue") as { epic_id: number | null; depends_on: string | null };
    expect(issue.epic_id).toBeNull();
    expect(issue.depends_on).toBeNull();
  });
});
