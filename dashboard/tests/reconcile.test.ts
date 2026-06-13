import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { createIssue, getIssue } from "@/lib/issues";
import { createRun, getRun } from "@/lib/runs";
import { finalizeRunExit, reconcileOrphanedRuns } from "@/lib/startRun";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-reconcile-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

function threadFile(projectSlug: string, issueId: number): string {
  return path.join(TEST_REPO_ROOT, "vault", "projects", projectSlug, "threads", `${issueId}.md`);
}

describe("reconcileOrphanedRuns (ADR-020)", () => {
  it("reconciles every orphan to interrupted/review and reports the count", () => {
    const issues = [1, 2, 3].map((n) => createIssue({ projectSlug: "x", title: `t${n}`, status: "running" }));
    const runs = issues.map((id, i) =>
      createRun({ issueId: id, agentSlug: "a", runtimeId: "claude-code", worktreePath: `/w${i}` })
    );

    expect(reconcileOrphanedRuns()).toBe(3);

    for (let i = 0; i < runs.length; i++) {
      expect(getRun(runs[i])!.exitStatus).toBe("interrupted");
      expect(getRun(runs[i])!.endedAt).not.toBeNull();
      expect(getIssue(issues[i])!.status).toBe("review");
    }
  });

  it("appends a run.interrupted thread event for each orphan", () => {
    const issueId = createIssue({ projectSlug: "x", title: "t", status: "running" });
    createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w" });

    reconcileOrphanedRuns();

    const body = fs.readFileSync(threadFile("x", issueId), "utf8");
    expect(body).toContain("event: run.interrupted");
  });

  it("is idempotent: a second pass is a no-op", () => {
    const issueId = createIssue({ projectSlug: "x", title: "t", status: "running" });
    createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w" });

    expect(reconcileOrphanedRuns()).toBe(1);
    expect(reconcileOrphanedRuns()).toBe(0);
    expect(getIssue(issueId)!.status).toBe("review");
  });

  it("a late real onExit does not overwrite an already-interrupted run", () => {
    const issueId = createIssue({ projectSlug: "x", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w" });

    reconcileOrphanedRuns();
    const endedAt = getRun(runId)!.endedAt;

    // The PTY's delayed onExit finally fires after reconciliation already ran.
    finalizeRunExit(runId, 1);

    expect(getRun(runId)!.exitStatus).toBe("interrupted");
    expect(getRun(runId)!.endedAt).toBe(endedAt);
    expect(getIssue(issueId)!.status).toBe("review");
  });

  it("leaves already-finished runs untouched", () => {
    const issueId = createIssue({ projectSlug: "x", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w" });
    finalizeRunExit(runId, 0);

    expect(reconcileOrphanedRuns()).toBe(0);
    expect(getRun(runId)!.exitStatus).toBe("done");
  });
});
