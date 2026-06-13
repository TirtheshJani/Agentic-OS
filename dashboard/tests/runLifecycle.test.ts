import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { createIssue, getIssue, chainDepth } from "@/lib/issues";
import { createRun, getRun } from "@/lib/runs";
import { finalizeRunExit, reconcileOrphanedRuns } from "@/lib/startRun";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-lifecycle-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("finalizeRunExit", () => {
  it("clean exit marks the run done and the issue review", () => {
    const issueId = createIssue({ projectSlug: "x", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w" });
    finalizeRunExit(runId, 0);
    expect(getRun(runId)!.exitStatus).toBe("done");
    expect(getRun(runId)!.endedAt).not.toBeNull();
    expect(getIssue(issueId)!.status).toBe("review");
    // The thread event landed under the stubbed repo root, not the real vault.
    expect(fs.existsSync(path.join(TEST_REPO_ROOT, "vault", "projects", "x", "threads", `${issueId}.md`))).toBe(true);
  });

  it("non-zero exit marks both failed", () => {
    const issueId = createIssue({ projectSlug: "x", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w" });
    finalizeRunExit(runId, 1);
    expect(getRun(runId)!.exitStatus).toBe("failed");
    expect(getIssue(issueId)!.status).toBe("failed");
  });

  it("is idempotent across the spawn-time and websocket callers", () => {
    const issueId = createIssue({ projectSlug: "x", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w" });
    finalizeRunExit(runId, 0);
    const endedAt = getRun(runId)!.endedAt;
    finalizeRunExit(runId, 1); // second caller with different code changes nothing
    expect(getRun(runId)!.exitStatus).toBe("done");
    expect(getRun(runId)!.endedAt).toBe(endedAt);
    expect(getIssue(issueId)!.status).toBe("review");
  });
});

describe("reconcileOrphanedRuns", () => {
  it("marks every run without ended_at interrupted and moves its issue to review, leaving finished runs alone (ADR-020)", () => {
    const orphanIssue = createIssue({ projectSlug: "x", title: "t", status: "running" });
    const orphanRun = createRun({ issueId: orphanIssue, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w1" });
    const doneIssue = createIssue({ projectSlug: "x", title: "t2", status: "running" });
    const doneRun = createRun({ issueId: doneIssue, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w2" });
    finalizeRunExit(doneRun, 0);

    expect(reconcileOrphanedRuns()).toBe(1);
    // Distinct from "failed": an environment interruption is not an agent failure.
    expect(getRun(orphanRun)!.exitStatus).toBe("interrupted");
    expect(getRun(orphanRun)!.endedAt).not.toBeNull();
    // Human-gated triage, not a "the agent broke" state.
    expect(getIssue(orphanIssue)!.status).toBe("review");
    expect(getRun(doneRun)!.exitStatus).toBe("done");
    expect(getIssue(doneIssue)!.status).toBe("review");

    // Idempotent: nothing left to reconcile.
    expect(reconcileOrphanedRuns()).toBe(0);
  });
});

describe("chainDepth", () => {
  it("walks parent links to the root", () => {
    const root = createIssue({ projectSlug: "x", title: "root" });
    const child = createIssue({ projectSlug: "x", title: "child", parentIssueId: root });
    const grandchild = createIssue({ projectSlug: "x", title: "grandchild", parentIssueId: child });
    expect(chainDepth(root)).toBe(0);
    expect(chainDepth(child)).toBe(1);
    expect(chainDepth(grandchild)).toBe(2);
  });

  it("round-trips parentIssueId through createIssue/getIssue", () => {
    const root = createIssue({ projectSlug: "x", title: "root" });
    const child = createIssue({ projectSlug: "x", title: "child", parentIssueId: root });
    expect(getIssue(child)!.parentIssueId).toBe(root);
  });
});
