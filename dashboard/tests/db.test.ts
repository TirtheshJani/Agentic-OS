import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, getMigrationVersion, closeDb } from "@/lib/db";

let dbPath: string;

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-db-"));
  dbPath = path.join(tmp, "state.db");
});

afterEach(() => {
  closeDb();
  if (fs.existsSync(dbPath)) {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  }
});

describe("db", () => {
  it("creates the schema on first open", () => {
    const db = openDb(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain("issues");
    expect(names).toContain("runs");
    expect(names).toContain("hook_events");
    expect(names).toContain("settings_kv");
    expect(names).toContain("schema_migrations");
    expect(names).toContain("schedule_state");
  });

  it("applies all migrations on first open", () => {
    openDb(dbPath);
    expect(getMigrationVersion()).toBe(4);
  });

  it("is idempotent on second open", () => {
    openDb(dbPath);
    closeDb();
    const db2 = openDb(dbPath);
    const count = (db2.prepare("SELECT COUNT(*) as n FROM schema_migrations").get() as { n: number }).n;
    expect(count).toBe(3); // versions 1, 3, 4
  });

  it("upgrades an older database in place", () => {
    // Simulate a pre-v3 database: open, then strip the v3 artifacts.
    const db = openDb(dbPath);
    db.exec("DROP TABLE schedule_state");
    db.prepare("DELETE FROM schema_migrations WHERE version = 3").run();
    closeDb();

    const db2 = openDb(dbPath);
    expect(getMigrationVersion()).toBe(4);
    const cols = db2.prepare("PRAGMA table_info(issues)").all() as Array<{ name: string }>;
    expect(cols.some(c => c.name === "parent_issue_id")).toBe(true);
  });
});
