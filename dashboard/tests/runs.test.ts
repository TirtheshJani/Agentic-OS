import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb } from "@/lib/db";
import { createRun, getRun, listRuns, listActiveRuns, listRecentRunsWithIssues, updateRun, attachSessionId } from "@/lib/runs";
import { createIssue } from "@/lib/issues";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-runs-"));
  openDb(path.join(tmp, "state.db"));
  // Seed enough issue rows so foreign-key references in the run tests resolve.
  for (let i = 0; i < 10; i++) createIssue({ projectSlug: "x", title: "x" });
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("runs", () => {
  it("creates and retrieves a run", () => {
    const id = createRun({
      issueId: 7,
      agentSlug: "lit-reviewer",
      runtimeId: "claude-code",
      worktreePath: "/ws/qml/.worktrees/issue-7",
    });
    expect(id).toBeGreaterThan(0);
    const r = getRun(id);
    expect(r).toBeTruthy();
    expect(r!.issueId).toBe(7);
    expect(r!.endedAt).toBeNull();
    expect(r!.ptySessionId).toBeNull();
    expect(r!.model).toBeNull();
  });

  it("persists the model when provided", () => {
    const id = createRun({
      issueId: 1,
      agentSlug: "x",
      runtimeId: "claude-code",
      worktreePath: "/p",
      model: "sonnet",
    });
    expect(getRun(id)!.model).toBe("sonnet");
  });

  it("listActiveRuns returns only runs without an ended_at", () => {
    const a = createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/p1" });
    const b = createRun({ issueId: 2, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/p2" });
    updateRun(b, { endedAt: Date.now(), exitStatus: "done" });
    const active = listActiveRuns();
    expect(active.map(r => r.id)).toEqual([a]);
  });

  it("attachSessionId sets pty_session_id", () => {
    const id = createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/p" });
    attachSessionId(id, "deadbeef-uuid");
    expect(getRun(id)!.ptySessionId).toBe("deadbeef-uuid");
  });

  it("listRecentRunsWithIssues joins issue title and project, newest first", () => {
    const a = createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/a", model: "opus" });
    const b = createRun({ issueId: 2, agentSlug: "y", runtimeId: "claude-code", worktreePath: "/b" });
    updateRun(b, { endedAt: Date.now(), exitStatus: "done" });

    const all = listRecentRunsWithIssues();
    expect(all.map(r => r.id)).toEqual([b, a]);
    expect(all[1].issueTitle).toBe("x");
    expect(all[1].projectSlug).toBe("x");
    expect(all[1].model).toBe("opus");

    const active = listRecentRunsWithIssues({ activeOnly: true });
    expect(active.map(r => r.id)).toEqual([a]);
  });

  it("listRuns filters by issue", () => {
    createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/a" });
    createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/b" });
    createRun({ issueId: 2, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/c" });
    expect(listRuns({ issueId: 1 })).toHaveLength(2);
    expect(listRuns({ issueId: 2 })).toHaveLength(1);
  });
});
