import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type Database from "better-sqlite3";
import { openDb, getMigrationVersion, closeDb } from "@/lib/db";
import { createEpic, rollupStatus, eligibleChildren } from "@/lib/epics";

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

// A body with a spec-0029 acceptance contract whose single assertion is `text`.
function contractBody(text: string): string {
  return `## Acceptance contract\n\n- [ ] ${text}\n`;
}

// Insert an issue under an epic and return its id. depends_on is a JSON array.
function insertChild(
  db: Database.Database,
  opts: {
    epicId: number;
    title: string;
    body?: string;
    status?: string;
    dependsOn?: number[];
  }
): number {
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO issues (project_slug, title, body, status, epic_id, depends_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      "demo",
      opts.title,
      opts.body ?? "",
      opts.status ?? "backlog",
      opts.epicId,
      opts.dependsOn ? JSON.stringify(opts.dependsOn) : null,
      now,
      now
    );
  return Number(info.lastInsertRowid);
}

// Mark a contract child as passing: a finished run plus a judge eval_result
// whose rubric passes every assertion in `texts`.
function markContractPass(db: Database.Database, issueId: number, texts: string[]): void {
  const now = Date.now();
  const run = db
    .prepare(
      `INSERT INTO runs (issue_id, agent_slug, runtime_id, worktree_path, started_at, ended_at, exit_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(issueId, "coder", "claude-code", "/tmp/wt", now, now, "completed");
  const rubric = JSON.stringify({
    correctness: 100,
    efficiency: 90,
    coherence: 90,
    rationale: "ok",
    assertions: texts.map((t) => ({ text: t, pass: true, reason: "ok" })),
  });
  db.prepare(
    `INSERT INTO eval_results (run_id, kind, rubric, score, grade, graded_at)
     VALUES (?, 'judge', ?, ?, ?, ?)`
  ).run(Number(run.lastInsertRowid), rubric, 96, "A", now);
}

describe("rollupStatus", () => {
  it("is empty for an epic with no children", () => {
    openDb(dbPath);
    const epicId = createEpic({ projectSlug: "demo", title: "epic" });
    expect(rollupStatus(epicId)).toBe("empty");
  });

  it("is done only when every child passes", () => {
    const db = openDb(dbPath);
    const epicId = createEpic({ projectSlug: "demo", title: "epic" });
    insertChild(db, { epicId, title: "a", status: "done" });
    insertChild(db, { epicId, title: "b", status: "done" });
    expect(rollupStatus(epicId)).toBe("done");
  });

  it("is in-progress when a child has not passed", () => {
    const db = openDb(dbPath);
    const epicId = createEpic({ projectSlug: "demo", title: "epic" });
    insertChild(db, { epicId, title: "a", status: "done" });
    insertChild(db, { epicId, title: "b", status: "running" });
    expect(rollupStatus(epicId)).toBe("in-progress");
  });

  it("honors the acceptance contract path for a child", () => {
    const db = openDb(dbPath);
    const epicId = createEpic({ projectSlug: "demo", title: "epic" });
    const text = "tests pass";
    const child = insertChild(db, {
      epicId,
      title: "c",
      body: contractBody(text),
      status: "done",
    });
    // A contract child with no graded judge run does not pass even when done.
    expect(rollupStatus(epicId)).toBe("in-progress");
    markContractPass(db, child, [text]);
    expect(rollupStatus(epicId)).toBe("done");
  });
});

describe("eligibleChildren", () => {
  it("excludes children with unmet dependencies, includes independent ones", () => {
    const db = openDb(dbPath);
    const epicId = createEpic({ projectSlug: "demo", title: "epic" });
    const dep = insertChild(db, { epicId, title: "dep", status: "running" });
    const dependent = insertChild(db, { epicId, title: "needs-dep", dependsOn: [dep] });
    const independent = insertChild(db, { epicId, title: "free" });

    const ids = eligibleChildren(epicId).map((c) => c.id).sort((x, y) => x - y);
    expect(ids).toContain(independent);
    expect(ids).toContain(dep); // dep itself has no deps, so it is eligible
    expect(ids).not.toContain(dependent);
  });

  it("makes a dependent child eligible once its dependency passes", () => {
    const db = openDb(dbPath);
    const epicId = createEpic({ projectSlug: "demo", title: "epic" });
    const dep = insertChild(db, { epicId, title: "dep", status: "running" });
    const dependent = insertChild(db, { epicId, title: "needs-dep", dependsOn: [dep] });

    expect(eligibleChildren(epicId).map((c) => c.id)).not.toContain(dependent);

    db.prepare("UPDATE issues SET status = 'done' WHERE id = ?").run(dep);
    expect(eligibleChildren(epicId).map((c) => c.id)).toContain(dependent);
  });
});
