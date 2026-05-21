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
  });

  it("records the initial migration version", () => {
    openDb(dbPath);
    expect(getMigrationVersion()).toBe(1);
  });

  it("is idempotent on second open", () => {
    openDb(dbPath);
    closeDb();
    const db2 = openDb(dbPath);
    const count = (db2.prepare("SELECT COUNT(*) as n FROM schema_migrations").get() as { n: number }).n;
    expect(count).toBe(1);
  });
});
