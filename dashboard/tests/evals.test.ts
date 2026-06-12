import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { resetBusForTesting, publish } from "@/lib/stream";
import { resetSettingsForTesting, setSettings } from "@/lib/settings";
import { createIssue } from "@/lib/issues";

// Mock the CLI answer module so no real CLI is ever spawned.
let cliReply: { ok: true; text: string } | { ok: false; error: string } = {
  ok: true,
  text: '{"correctness": 90, "efficiency": 80, "coherence": 70, "rationale": "solid"}',
};
let cliCalls = 0;
vi.mock("@/lib/rag/answer/cliAnswer", () => ({
  runCliAnswer: () => {
    cliCalls++;
    return cliReply;
  },
}));

const { gradeRunMetrics, gradeRunWithJudge, ungradedRunIds } = await import("@/lib/evals/store");
const { buildJudgePrompt, compositeScore, letterGrade, parseJudgeReply } = await import("@/lib/evals/judge");
const { startEvalAutoGrade } = await import("@/lib/evals/autoGrade");

let stopAutoGrade: (() => void) | null = null;

function seedRun(exitStatus = "done"): number {
  const issueId = createIssue({ projectSlug: "p", title: "Do the task", body: "Acceptance: done" });
  const info = getDb()
    .prepare(
      "INSERT INTO runs (issue_id, agent_slug, runtime_id, worktree_path, started_at, ended_at, exit_status) VALUES (?, 'a', 'claude-code', ?, 1000, 61000, ?)"
    )
    .run(issueId, path.join(TEST_REPO_ROOT, "nonexistent-worktree"), exitStatus);
  return Number(info.lastInsertRowid);
}

beforeEach(() => {
  cliCalls = 0;
  cliReply = { ok: true, text: '{"correctness": 90, "efficiency": 80, "coherence": 70, "rationale": "solid"}' };
  // Unique state dir per test: setSettings persists to disk, and a stale
  // settings.json from a prior test would leak provider config.
  process.env.AGENTIC_OS_STATE_DIR = path.join(TEST_REPO_ROOT, `.agentic-os-${Date.now()}-${Math.random()}`);
  resetSettingsForTesting();
  resetBusForTesting();
  openDb(path.join(TEST_REPO_ROOT, `state-evals-${Date.now()}-${Math.random()}.db`));
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

describe("judge pure functions", () => {
  it("computes composite score and letter grades", () => {
    const rubric = { correctness: 90, efficiency: 80, coherence: 70, rationale: "" };
    expect(compositeScore(rubric)).toBeCloseTo(90 * 0.4 + 80 * 0.3 + 70 * 0.3);
    expect(letterGrade(95)).toBe("A");
    expect(letterGrade(81)).toBe("B");
    expect(letterGrade(59)).toBe("F");
  });

  it("builds a bounded prompt with task and metrics", () => {
    const prompt = buildJudgePrompt({
      issueTitle: "Fix bug",
      issueBody: "x".repeat(50_000),
      metrics: { durationMs: 1, exitStatus: "done" } as never,
      transcriptPath: null,
    });
    expect(prompt).toContain("Fix bug");
    expect(prompt.length).toBeLessThanOrEqual(24_000);
  });

  it("rejects invalid judge replies", () => {
    expect(parseJudgeReply("not json").ok).toBe(false);
    expect(parseJudgeReply('{"correctness": 150, "efficiency": 1, "coherence": 1}').ok).toBe(false);
  });
});

describe("grading", () => {
  it("metrics row is written without any CLI call", () => {
    const runId = seedRun();
    const metrics = gradeRunMetrics(runId);
    expect(metrics?.durationMs).toBe(60_000);
    expect(cliCalls).toBe(0);
    const row = getDb().prepare("SELECT kind FROM eval_results WHERE run_id = ?").get(runId) as { kind: string };
    expect(row.kind).toBe("metrics");
  });

  it("judge grading stores score, grade, and rubric; re-grade replaces", () => {
    const runId = seedRun();
    const result = gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.grade).toBe("B");

    cliReply = { ok: true, text: '{"correctness": 100, "efficiency": 100, "coherence": 100, "rationale": "perfect"}' };
    const second = gradeRunWithJudge(runId);
    if (second.ok) expect(second.grade).toBe("A");
    const n = (getDb().prepare("SELECT COUNT(*) AS n FROM eval_results WHERE run_id = ? AND kind = 'judge'").get(runId) as {
      n: number;
    }).n;
    expect(n).toBe(1);
  });

  it("returns an error when the provider is none", () => {
    setSettings({ rag: { answerProvider: "none" } as never });
    const result = gradeRunWithJudge(seedRun());
    expect(result.ok).toBe(false);
    expect(cliCalls).toBe(0);
  });

  it("lists ungraded runs", () => {
    const a = seedRun();
    const b = seedRun();
    gradeRunWithJudge(a);
    expect(ungradedRunIds(10)).toEqual([b]);
  });
});

describe("autoGrade gating", () => {
  it("computes metrics on run.finalized but never judges by default", () => {
    const runId = seedRun();
    stopAutoGrade = startEvalAutoGrade();
    publish({ kind: "run.finalized", runId, issueId: 1, projectSlug: "p", exitStatus: "done" });
    const rows = getDb().prepare("SELECT kind FROM eval_results WHERE run_id = ?").all(runId) as Array<{ kind: string }>;
    expect(rows.map((r) => r.kind)).toEqual(["metrics"]);
    expect(cliCalls).toBe(0);
  });

  it("judges only when autoGrade AND autonomy are both on", () => {
    setSettings({
      autonomy: { enabled: true, llmRouting: false, schedulerEnabled: false, maxChainDepth: 3 },
      evals: { judgeProvider: "inherit", autoGradeEnabled: true, batchLimit: 10 },
    });
    const runId = seedRun();
    stopAutoGrade = startEvalAutoGrade();
    publish({ kind: "run.finalized", runId, issueId: 1, projectSlug: "p", exitStatus: "done" });
    expect(cliCalls).toBe(1);
    const kinds = (getDb().prepare("SELECT kind FROM eval_results WHERE run_id = ? ORDER BY kind").all(runId) as Array<{
      kind: string;
    }>).map((r) => r.kind);
    expect(kinds).toEqual(["judge", "metrics"]);
  });
});
