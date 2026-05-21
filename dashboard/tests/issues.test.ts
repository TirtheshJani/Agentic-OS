import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb } from "@/lib/db";
import {
  createIssue,
  getIssue,
  listIssues,
  updateIssue,
  deleteIssue,
  type IssueStatus,
} from "@/lib/issues";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-issues-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("issues", () => {
  it("creates and retrieves an issue", () => {
    const id = createIssue({
      projectSlug: "qml",
      title: "Draft related work",
      body: "Cover the last 5 years of QML in diagnostics.",
      assigneeSlug: "lit-reviewer",
      priority: 1,
      mode: "async",
      labels: ["draft", "research"],
    });
    expect(id).toBeGreaterThan(0);

    const issue = getIssue(id);
    expect(issue).toBeTruthy();
    expect(issue!.title).toBe("Draft related work");
    expect(issue!.status).toBe("backlog");
    expect(issue!.assigneeSlug).toBe("lit-reviewer");
    expect(issue!.priority).toBe(1);
    expect(issue!.labels).toEqual(["draft", "research"]);
  });

  it("lists issues filtered by project and status", () => {
    createIssue({ projectSlug: "qml", title: "A", body: "" });
    createIssue({ projectSlug: "qml", title: "B", body: "" });
    createIssue({ projectSlug: "other", title: "C", body: "" });

    expect(listIssues({ projectSlug: "qml" })).toHaveLength(2);
    expect(listIssues({ projectSlug: "other" })).toHaveLength(1);
    expect(listIssues({ projectSlug: "qml", status: "backlog" })).toHaveLength(2);
    expect(listIssues({ projectSlug: "qml", status: "running" })).toHaveLength(0);
  });

  it("updates issue fields", () => {
    const id = createIssue({ projectSlug: "qml", title: "T", body: "" });
    updateIssue(id, { status: "queued" as IssueStatus, priority: 2 });
    const after = getIssue(id);
    expect(after!.status).toBe("queued");
    expect(after!.priority).toBe(2);
  });

  it("rejects invalid status transitions implicitly (caller responsibility)", () => {
    // Note: validation lives at the API level; the DB accepts any status string.
    // This test just confirms there's no DB-level constraint preventing flexibility.
    const id = createIssue({ projectSlug: "qml", title: "T", body: "" });
    updateIssue(id, { status: "done" as IssueStatus });
    expect(getIssue(id)!.status).toBe("done");
  });

  it("deletes an issue", () => {
    const id = createIssue({ projectSlug: "qml", title: "T", body: "" });
    deleteIssue(id);
    expect(getIssue(id)).toBeNull();
  });

  it("orders list by priority desc then updated_at desc", () => {
    const a = createIssue({ projectSlug: "qml", title: "A", body: "", priority: 0 });
    // Sleep a millisecond to ensure timestamps differ.
    const before = Date.now();
    while (Date.now() === before) {}
    const b = createIssue({ projectSlug: "qml", title: "B", body: "", priority: 0 });
    const c = createIssue({ projectSlug: "qml", title: "C", body: "", priority: 1 });
    const list = listIssues({ projectSlug: "qml" });
    expect(list.map(i => i.id)).toEqual([c, b, a]);
  });
});
