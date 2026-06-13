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

// Mock the behavioral harness for determinism: tests script the validator's
// outcome instead of launching a live app. `behavioralResults` is the canned
// return; `behavioralCalls` records the call so the flag-off regression guard
// can assert the harness was never invoked.
import type { BehavioralResult } from "@/lib/evals/behavioral";
let behavioralResults: BehavioralResult[] = [];
let behavioralCalls = 0;
let behavioralArgs: { worktreePath: string; assertions: string[] } | null = null;
vi.mock("@/lib/evals/behavioral", () => ({
  runBehavioralAssertions: async (worktreePath: string, assertions: string[]) => {
    behavioralCalls++;
    behavioralArgs = { worktreePath, assertions };
    return behavioralResults;
  },
}));

const { gradeRunMetrics, gradeRunWithJudge, ungradedRunIds } = await import("@/lib/evals/store");
const { buildJudgePrompt, compositeScore, letterGrade, parseJudgeReply } = await import("@/lib/evals/judge");
const { startEvalAutoGrade } = await import("@/lib/evals/autoGrade");

let stopAutoGrade: (() => void) | null = null;

function seedRun(exitStatus = "done", body = "Acceptance: done"): number {
  const issueId = createIssue({ projectSlug: "p", title: "Do the task", body });
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
  behavioralCalls = 0;
  behavioralResults = [];
  behavioralArgs = null;
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

  it("derives correctness from assertions and rejects replies lacking both", () => {
    const ok = parseJudgeReply(
      JSON.stringify({
        assertions: [
          { text: "x", pass: true, reason: "" },
          { text: "y", pass: false, reason: "" },
        ],
        efficiency: 50,
        coherence: 50,
      })
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.rubric.correctness).toBe(50); // 1 of 2 passed
      expect(ok.rubric.assertions).toHaveLength(2);
    }
    // No correctness and no assertions is not a gradeable rubric.
    expect(parseJudgeReply('{"efficiency": 50, "coherence": 50}').ok).toBe(false);
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

  it("judge grading stores score, grade, and rubric; re-grade replaces", async () => {
    const runId = seedRun();
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.grade).toBe("B");

    cliReply = { ok: true, text: '{"correctness": 100, "efficiency": 100, "coherence": 100, "rationale": "perfect"}' };
    const second = await gradeRunWithJudge(runId);
    if (second.ok) expect(second.grade).toBe("A");
    const n = (getDb().prepare("SELECT COUNT(*) AS n FROM eval_results WHERE run_id = ? AND kind = 'judge'").get(runId) as {
      n: number;
    }).n;
    expect(n).toBe(1);
  });

  it("returns an error when the provider is none", async () => {
    setSettings({ rag: { answerProvider: "none" } as never });
    const result = await gradeRunWithJudge(seedRun());
    expect(result.ok).toBe(false);
    expect(cliCalls).toBe(0);
  });

  it("lists ungraded runs", async () => {
    const a = seedRun();
    const b = seedRun();
    await gradeRunWithJudge(a);
    expect(ungradedRunIds(10)).toEqual([b]);
  });
});

describe("contract grading", () => {
  const contractBody = ["Do the task.", "", "## Acceptance contract", "- [ ] A holds", "- [ ] B holds"].join("\n");

  it("derives correctness from the pass fraction and persists the assertions", async () => {
    cliReply = {
      ok: true,
      text: JSON.stringify({
        assertions: [
          { text: "A holds", pass: true, reason: "did A" },
          { text: "B holds", pass: false, reason: "missed B" },
        ],
        efficiency: 80,
        coherence: 70,
        rationale: "half done",
      }),
    };
    const runId = seedRun("done", contractBody);
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);

    const row = getDb()
      .prepare("SELECT rubric, score FROM eval_results WHERE run_id = ? AND kind = 'judge'")
      .get(runId) as { rubric: string; score: number };
    const rubric = JSON.parse(row.rubric);
    expect(rubric.correctness).toBe(50); // one of two assertions passed
    expect(rubric.assertions).toHaveLength(2);
    expect(rubric.assertions[1]).toMatchObject({ text: "B holds", pass: false });
    expect(row.score).toBeCloseTo(50 * 0.4 + 80 * 0.3 + 70 * 0.3);
  });

  it("falls back to the generic rubric when the issue has no contract", async () => {
    // default cliReply is the generic 90/80/70 shape
    const runId = seedRun("done", "Plain task. Acceptance: done");
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);

    const row = getDb()
      .prepare("SELECT rubric FROM eval_results WHERE run_id = ? AND kind = 'judge'")
      .get(runId) as { rubric: string };
    const rubric = JSON.parse(row.rubric);
    expect(rubric.correctness).toBe(90);
    expect(rubric.assertions).toBeUndefined();
  });
});

describe("behavioral reconciliation (spec 0032 / ADR-025)", () => {
  // Contract with one `(e2e)` (behavioral) assertion and one judge-only assertion.
  const e2eBody = [
    "Do the task.",
    "",
    "## Acceptance contract",
    "- [ ] The page renders (e2e)",
    "- [ ] Helper returns the right shape",
  ].join("\n");

  // The judge passes BOTH assertions; correctness would be 100 absent any override.
  function judgeBothPass(): void {
    cliReply = {
      ok: true,
      text: JSON.stringify({
        assertions: [
          { text: "The page renders", pass: true, reason: "looks right" },
          { text: "Helper returns the right shape", pass: true, reason: "shape ok" },
        ],
        efficiency: 80,
        coherence: 70,
        rationale: "all good",
      }),
    };
  }

  function persistedRubric(runId: number): {
    correctness: number;
    assertions: Array<{ text: string; pass: boolean; reason: string }>;
  } {
    const row = getDb()
      .prepare("SELECT rubric FROM eval_results WHERE run_id = ? AND kind = 'judge'")
      .get(runId) as { rubric: string };
    return JSON.parse(row.rubric);
  }

  it("flag OFF: grading is byte-for-byte today's and the harness is never called", async () => {
    judgeBothPass();
    // Flag defaults to off; do not enable it.
    behavioralResults = [{ assertion: "The page renders", status: "fail", reason: "would override if run" }];
    const runId = seedRun("done", e2eBody);
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);

    expect(behavioralCalls).toBe(0); // harness must not run when the flag is off
    const rubric = persistedRubric(runId);
    // Both assertions stay pass -> correctness 100, untouched by the (ignored) fail.
    expect(rubric.correctness).toBe(100);
    expect(rubric.assertions.every((a) => a.pass)).toBe(true);
  });

  it("flag ON: a behavioral fail overrides the judge pass and drops correctness", async () => {
    setSettings({
      evals: {
        judgeProvider: "inherit",
        autoGradeEnabled: false,
        batchLimit: 10,
        reviseThreshold: 70,
        behavioralEnabled: true,
      },
    });
    judgeBothPass();
    behavioralResults = [{ assertion: "The page renders", status: "fail", reason: "button missing in live app" }];
    const runId = seedRun("done", e2eBody);
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);

    expect(behavioralCalls).toBe(1);
    // Only the `(e2e)` assertion is handed to the harness.
    expect(behavioralArgs?.assertions).toEqual(["The page renders"]);

    const rubric = persistedRubric(runId);
    const rendered = rubric.assertions.find((a) => a.text === "The page renders");
    expect(rendered?.pass).toBe(false); // behavioral fail wins
    expect(rendered?.reason).toBe("button missing in live app");
    expect(rubric.correctness).toBe(50); // 1 of 2 now passes
  });

  it("flag ON: an inconclusive behavioral result does not override the judge verdict", async () => {
    setSettings({
      evals: {
        judgeProvider: "inherit",
        autoGradeEnabled: false,
        batchLimit: 10,
        reviseThreshold: 70,
        behavioralEnabled: true,
      },
    });
    judgeBothPass();
    behavioralResults = [{ assertion: "The page renders", status: "inconclusive", reason: "could not tell" }];
    const runId = seedRun("done", e2eBody);
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);

    expect(behavioralCalls).toBe(1);
    const rubric = persistedRubric(runId);
    // Judge said pass; inconclusive is not a fail, so the verdict stands.
    expect(rubric.assertions.every((a) => a.pass)).toBe(true);
    expect(rubric.correctness).toBe(100);
  });

  it("flag ON but no (e2e) assertion: harness is skipped and grading is unchanged", async () => {
    setSettings({
      evals: {
        judgeProvider: "inherit",
        autoGradeEnabled: false,
        batchLimit: 10,
        reviseThreshold: 70,
        behavioralEnabled: true,
      },
    });
    cliReply = {
      ok: true,
      text: JSON.stringify({
        assertions: [{ text: "A holds", pass: true, reason: "did A" }],
        efficiency: 80,
        coherence: 70,
        rationale: "ok",
      }),
    };
    const noE2eBody = ["Do the task.", "", "## Acceptance contract", "- [ ] A holds"].join("\n");
    const runId = seedRun("done", noE2eBody);
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);
    expect(behavioralCalls).toBe(0); // no `(e2e)` assertion -> no harness run
  });

  it("flag ON: a timeout-bounded inconclusive still completes grading without hanging", async () => {
    setSettings({
      evals: {
        judgeProvider: "inherit",
        autoGradeEnabled: false,
        batchLimit: 10,
        reviseThreshold: 70,
        behavioralEnabled: true,
      },
    });
    judgeBothPass();
    // Simulate the harness hitting its cap: it resolves (never hangs) to
    // inconclusive with a timeout reason. Grading must complete.
    behavioralResults = [{ assertion: "The page renders", status: "inconclusive", reason: "behavioral timeout after 120000ms" }];
    const runId = seedRun("done", e2eBody);
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);
    expect(behavioralCalls).toBe(1);
    // Inconclusive (even from a timeout) does not override; correctness stays 100.
    expect(persistedRubric(runId).correctness).toBe(100);
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
      evals: { judgeProvider: "inherit", autoGradeEnabled: true, batchLimit: 10, reviseThreshold: 70 },
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
