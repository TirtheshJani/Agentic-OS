import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { resetBusForTesting } from "@/lib/stream";
import { resetSettingsForTesting, setSettings } from "@/lib/settings";
import { createIssue } from "@/lib/issues";

// Mock the CLI answer module so no real CLI is ever spawned. The judge passes
// both contract assertions; behavioral persistence is what we assert here.
const cliReply: { ok: true; text: string } | { ok: false; error: string } = {
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
vi.mock("@/lib/rag/answer/cliAnswer", () => ({
  runCliAnswer: () => cliReply,
}));

// Mock the behavioral harness so tests script the validator outcome instead of
// launching a live app. `behavioralResults` is the canned return.
import type { BehavioralResult } from "@/lib/evals/behavioral";
let behavioralResults: BehavioralResult[] = [];
vi.mock("@/lib/evals/behavioral", () => ({
  runBehavioralAssertions: async () => behavioralResults,
}));

const { gradeRunWithJudge, getJudgeRubric } = await import("@/lib/evals/store");

// Contract with one `(e2e)` (behavioral) assertion and one judge-only assertion.
const e2eBody = [
  "Do the task.",
  "",
  "## Acceptance contract",
  "- [ ] The page renders (e2e)",
  "- [ ] Helper returns the right shape",
].join("\n");

function seedRun(exitStatus = "done", body = e2eBody): number {
  const issueId = createIssue({ projectSlug: "p", title: "Do the task", body });
  const info = getDb()
    .prepare(
      "INSERT INTO runs (issue_id, agent_slug, runtime_id, worktree_path, started_at, ended_at, exit_status) VALUES (?, 'a', 'claude-code', ?, 1000, 61000, ?)"
    )
    .run(issueId, path.join(TEST_REPO_ROOT, "nonexistent-worktree"), exitStatus);
  return Number(info.lastInsertRowid);
}

function enableBehavioral(): void {
  setSettings({
    evals: {
      judgeProvider: "inherit",
      autoGradeEnabled: false,
      batchLimit: 10,
      reviseThreshold: 70,
      behavioralEnabled: true,
    },
  });
}

beforeEach(() => {
  behavioralResults = [];
  process.env.AGENTIC_OS_STATE_DIR = path.join(TEST_REPO_ROOT, `.agentic-os-${Date.now()}-${Math.random()}`);
  resetSettingsForTesting();
  resetBusForTesting();
  openDb(path.join(TEST_REPO_ROOT, `state-behavioral-${Date.now()}-${Math.random()}.db`));
});

afterEach(() => {
  resetBusForTesting();
  resetSettingsForTesting();
  closeDb();
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("behavioral rubric persistence (spec 0032 / ADR-025)", () => {
  it("flag ON: persists the raw behavioral array with all statuses and the screenshot path", async () => {
    enableBehavioral();
    behavioralResults = [
      { assertion: "passes", status: "pass", reason: "ok" },
      { assertion: "The page renders", status: "fail", reason: "button missing in live app" },
      { assertion: "unclear", status: "inconclusive", reason: "could not tell", screenshotPath: "/tmp/shot-1.png" },
    ];
    const runId = seedRun();
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);

    const rubric = getJudgeRubric(runId);
    expect(rubric?.behavioral).toHaveLength(3);
    const statuses = rubric?.behavioral?.map((b) => b.status);
    expect(statuses).toEqual(["pass", "fail", "inconclusive"]);
    const shot = rubric?.behavioral?.find((b) => b.status === "inconclusive");
    expect(shot?.screenshotPath).toBe("/tmp/shot-1.png");
  });

  it("override fires when the judge reflows casing/punctuation of the assertion text", async () => {
    enableBehavioral();
    // The judge echoes the assertion with different casing and a trailing
    // period; the behavioral validator fails the canonical text. Exact-string
    // matching would miss, so the override would silently not fire. With
    // normalizeAssertionText the override still flips the assertion to false.
    const original = (cliReply as { text: string }).text;
    (cliReply as { text: string }).text = JSON.stringify({
      assertions: [
        { text: "The Page Renders.", pass: true, reason: "judge thought so" },
        { text: "Helper returns the right shape", pass: true, reason: "shape ok" },
      ],
      efficiency: 80,
      coherence: 70,
      rationale: "all good",
    });
    behavioralResults = [
      { assertion: "the page renders", status: "fail", reason: "button missing in live app" },
    ];
    try {
      const runId = seedRun();
      const result = await gradeRunWithJudge(runId);
      expect(result.ok).toBe(true);

      const rubric = getJudgeRubric(runId);
      const reflowed = rubric?.assertions?.find((a) => a.text === "The Page Renders.");
      expect(reflowed?.pass).toBe(false);
      expect(reflowed?.reason).toBe("button missing in live app");
    } finally {
      (cliReply as { text: string }).text = original;
    }
  });

  it("flag OFF: the persisted rubric has no `behavioral` key (regression guard)", async () => {
    // Flag defaults to off; do not enable it. A canned result would persist if
    // the harness ran, so its absence proves the harness never ran.
    behavioralResults = [{ assertion: "The page renders", status: "fail", reason: "would persist if run" }];
    const runId = seedRun();
    const result = await gradeRunWithJudge(runId);
    expect(result.ok).toBe(true);

    const rubric = getJudgeRubric(runId) as Record<string, unknown> | null;
    expect(rubric).not.toBeNull();
    expect(rubric).not.toHaveProperty("behavioral");
  });
});
