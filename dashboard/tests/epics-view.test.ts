import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, getDb, closeDb } from "@/lib/db";
import { createIssue } from "@/lib/issues";
import { createEpic } from "@/lib/epics";
import { assembleEpicsView } from "@/lib/epicsView";
import { epicChildIssue, type IssueTemplate } from "@/lib/issueTemplates";

let dbPath: string;

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-epics-view-"));
  dbPath = path.join(tmp, "state.db");
  openDb(dbPath);
});

afterEach(() => {
  closeDb();
  if (fs.existsSync(dbPath)) {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  }
});

// Read epic_id and depends_on straight off the row to assert persistence.
function rawCols(id: number): { epic_id: number | null; depends_on: string | null } {
  return getDb()
    .prepare("SELECT epic_id, depends_on FROM issues WHERE id = ?")
    .get(id) as { epic_id: number | null; depends_on: string | null };
}

describe("createIssue epic wiring", () => {
  it("round-trips epicId and dependsOn", () => {
    const epicId = createEpic({ projectSlug: "demo", title: "epic" });
    const id = createIssue({
      projectSlug: "demo",
      title: "child",
      epicId,
      dependsOn: JSON.stringify([3, 4]),
    });
    const row = rawCols(id);
    expect(row.epic_id).toBe(epicId);
    expect(row.depends_on).toBe("[3,4]");
  });

  it("defaults epic_id and depends_on to null for an existing-style create (regression)", () => {
    const id = createIssue({ projectSlug: "demo", title: "plain" });
    const row = rawCols(id);
    expect(row.epic_id).toBeNull();
    expect(row.depends_on).toBeNull();
  });
});

describe("assembleEpicsView", () => {
  it("returns an epic with rollup, dependency-ordered children, and eligibility flags", () => {
    const epicId = createEpic({ projectSlug: "demo", title: "mission", why: "ship it" });
    // dep: independent, still running (so not yet passed)
    const dep = createIssue({ projectSlug: "demo", title: "dep", status: "running", epicId });
    // dependent: blocked because its dependency has not passed
    createIssue({
      projectSlug: "demo",
      title: "needs-dep",
      epicId,
      dependsOn: JSON.stringify([dep]),
    });
    // free: independent, eligible
    createIssue({ projectSlug: "demo", title: "free", epicId });

    const views = assembleEpicsView("demo");
    expect(views).toHaveLength(1);
    const view = views[0];
    expect(view.id).toBe(epicId);
    expect(view.why).toBe("ship it");
    expect(view.rollup).toBe("in-progress");

    // Eligible children sort ahead of blocked ones.
    const eligibleFlags = view.children.map((c) => c.eligible);
    const firstBlocked = eligibleFlags.indexOf(false);
    if (firstBlocked !== -1) {
      // No eligible child appears after the first blocked one.
      expect(eligibleFlags.slice(firstBlocked).every((e) => e === false)).toBe(true);
    }
    const blocked = view.children.find((c) => c.title === "needs-dep");
    expect(blocked?.eligible).toBe(false);
    const free = view.children.find((c) => c.title === "free");
    expect(free?.eligible).toBe(true);
  });

  it("is empty rollup with no children and still renders fully without a milestone", () => {
    const epicId = createEpic({ projectSlug: "demo", title: "bare" });
    const views = assembleEpicsView("demo");
    const view = views.find((v) => v.id === epicId)!;
    expect(view.rollup).toBe("empty");
    expect(view.milestone).toBeNull();
    expect(view.children).toEqual([]);
  });

  it("filters by projectSlug", () => {
    createEpic({ projectSlug: "demo", title: "a" });
    createEpic({ projectSlug: "other", title: "b" });
    expect(assembleEpicsView("demo").map((v) => v.title)).toEqual(["a"]);
    expect(assembleEpicsView("other").map((v) => v.title)).toEqual(["b"]);
  });
});

describe("epicChildIssue template helper", () => {
  const base: IssueTemplate = { title: "T", body: "do the thing", labels: ["x"] };

  it("emits the depends_on reference and appends a Depends on line", () => {
    const tmpl = epicChildIssue({ epicId: 7, base, dependsOn: [3, 4] });
    expect(tmpl.epicId).toBe(7);
    expect(tmpl.dependsOn).toBe("[3,4]");
    expect(tmpl.body).toContain("Depends on: #3, #4");
  });

  it("changes nothing when there are no dependencies", () => {
    const tmpl = epicChildIssue({ epicId: 7, base });
    expect(tmpl.dependsOn).toBeNull();
    expect(tmpl.body).toBe(base.body);
    expect(tmpl.title).toBe(base.title);
    expect(tmpl.labels).toEqual(base.labels);
  });
});
