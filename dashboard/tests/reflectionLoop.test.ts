import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { resetBusForTesting, publish } from "@/lib/stream";
import { resetSettingsForTesting, setSettings } from "@/lib/settings";
import { createIssue, getIssue } from "@/lib/issues";
import { readThread } from "@/lib/threads";

// Mock the CLI answer module so no real CLI is ever spawned. Default reply is a
// LOW score (composite 30) so the reflection loop triggers unless told otherwise.
let cliReply: { ok: true; text: string } | { ok: false; error: string } = {
  ok: true,
  text: '{"correctness": 30, "efficiency": 30, "coherence": 30, "rationale": "weak; missing the key change"}',
};
let cliCalls = 0;
vi.mock("@/lib/rag/answer/cliAnswer", () => ({
  runCliAnswer: () => {
    cliCalls++;
    return cliReply;
  },
}));

const { startEvalAutoGrade } = await import("@/lib/evals/autoGrade");

let stopAutoGrade: (() => void) | null = null;

const LOW = '{"correctness": 30, "efficiency": 30, "coherence": 30, "rationale": "weak; missing the key change"}';
const HIGH = '{"correctness": 95, "efficiency": 90, "coherence": 90, "rationale": "solid"}';

/** Seed a finished run on a fresh issue. Returns { runId, issueId }. */
function seedRun(opts: { exitStatus?: string; parentIssueId?: number; assignee?: string } = {}): { runId: number; issueId: number } {
  const issueId = createIssue({
    projectSlug: "p",
    title: "Do the task",
    body: "Plain task. Acceptance: done",
    assigneeSlug: opts.assignee ?? "agent-x",
    status: "done",
    parentIssueId: opts.parentIssueId ?? null,
  });
  const info = getDb()
    .prepare(
      "INSERT INTO runs (issue_id, agent_slug, runtime_id, worktree_path, started_at, ended_at, exit_status) VALUES (?, 'agent-x', 'claude-code', ?, 1000, 61000, ?)"
    )
    .run(issueId, path.join(TEST_REPO_ROOT, "nonexistent-worktree"), opts.exitStatus ?? "done");
  return { runId: Number(info.lastInsertRowid), issueId };
}

function gatesOn() {
  setSettings({
    autonomy: { enabled: true, llmRouting: false, schedulerEnabled: false, maxChainDepth: 3 },
    evals: { judgeProvider: "inherit", autoGradeEnabled: true, batchLimit: 10, reviseThreshold: 70 },
  });
}

function childIssuesOf(parentId: number): Array<{ id: number; status: string; assignee_slug: string; body: string }> {
  return getDb()
    .prepare("SELECT id, status, assignee_slug, body FROM issues WHERE parent_issue_id = ?")
    .all(parentId) as Array<{ id: number; status: string; assignee_slug: string; body: string }>;
}

// The auto-grade subscriber is async (it awaits the judge), so revision filing
// lands on a later task. Drain the queue after publishing before asserting.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  cliCalls = 0;
  cliReply = { ok: true, text: LOW };
  process.env.AGENTIC_OS_STATE_DIR = path.join(TEST_REPO_ROOT, `.agentic-os-${Date.now()}-${Math.random()}`);
  resetSettingsForTesting();
  resetBusForTesting();
  openDb(path.join(TEST_REPO_ROOT, `state-reflect-${Date.now()}-${Math.random()}.db`));
});

afterEach(() => {
  stopAutoGrade?.();
  stopAutoGrade = null;
  resetBusForTesting();
  resetSettingsForTesting();
  closeDb();
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("reflection loop", () => {
  it("files no revision when the gates are off, even on a low score", () => {
    const { runId, issueId } = seedRun();
    stopAutoGrade = startEvalAutoGrade();
    publish({ kind: "run.finalized", runId, issueId, projectSlug: "p", exitStatus: "done" });
    expect(cliCalls).toBe(0); // judge never runs without both gates
    expect(childIssuesOf(issueId)).toHaveLength(0);
  });

  it("files exactly one queued revision child on a sub-threshold score", async () => {
    gatesOn();
    const { runId, issueId } = seedRun({ assignee: "agent-x" });
    stopAutoGrade = startEvalAutoGrade();
    publish({ kind: "run.finalized", runId, issueId, projectSlug: "p", exitStatus: "done" });
    await flush();

    expect(cliCalls).toBe(1);
    const children = childIssuesOf(issueId);
    expect(children).toHaveLength(1);
    expect(children[0].status).toBe("queued");
    expect(children[0].assignee_slug).toBe("agent-x");
    expect(children[0].body.toLowerCase()).toContain("revise to address");

    const events = readThread("p", issueId).filter((e) => e.kind === "event" && e.eventType === "revision.filed");
    expect(events).toHaveLength(1);
  });

  it("caps at one round: a low score on a revision escalates the issue to review", async () => {
    gatesOn();
    const parent = createIssue({ projectSlug: "p", title: "Original", body: "x", status: "done" });
    // The graded run sits on an issue that is itself a revision (has a parent).
    const { runId, issueId } = seedRun({ parentIssueId: parent });
    stopAutoGrade = startEvalAutoGrade();
    publish({ kind: "run.finalized", runId, issueId, projectSlug: "p", exitStatus: "done" });
    await flush();

    expect(cliCalls).toBe(1);
    expect(childIssuesOf(issueId)).toHaveLength(0); // no grandchild
    expect(getIssue(issueId)?.status).toBe("review"); // escalated instead
    const events = readThread("p", issueId).filter((e) => e.kind === "event" && e.eventType === "revision.escalated");
    expect(events).toHaveLength(1);
  });

  it("files no revision when the score is at or above the threshold", () => {
    gatesOn();
    cliReply = { ok: true, text: HIGH };
    const { runId, issueId } = seedRun();
    stopAutoGrade = startEvalAutoGrade();
    publish({ kind: "run.finalized", runId, issueId, projectSlug: "p", exitStatus: "done" });

    expect(cliCalls).toBe(1); // judged
    expect(childIssuesOf(issueId)).toHaveLength(0); // but not revised
  });

  it("never judges or revises interrupted or failed runs", () => {
    gatesOn();
    for (const exitStatus of ["interrupted", "failed"]) {
      const { runId, issueId } = seedRun({ exitStatus });
      stopAutoGrade = startEvalAutoGrade();
      publish({ kind: "run.finalized", runId, issueId, projectSlug: "p", exitStatus: exitStatus as never });
      expect(childIssuesOf(issueId)).toHaveLength(0);
      stopAutoGrade();
      stopAutoGrade = null;
    }
    expect(cliCalls).toBe(0);
  });
});
