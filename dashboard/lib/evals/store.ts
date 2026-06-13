// dashboard/lib/evals/store.ts
import { getDb } from "@/lib/db";
import { getRun } from "@/lib/runs";
import { computeRunMetrics, type RunMetrics } from "@/lib/evals/metrics";
import {
  buildJudgePrompt,
  compositeScore,
  letterGrade,
  resolveJudgeProvider,
  runJudge,
  WEIGHTS,
  type Rubric,
} from "@/lib/evals/judge";
import { getIssue } from "@/lib/issues";
import { parseContract } from "@/lib/evals/contract";
import { parseHandoff } from "@/lib/handoff";
import { runBehavioralAssertions, type BehavioralResult } from "@/lib/evals/behavioral";
import { getSettings } from "@/lib/settings";
import { publish } from "@/lib/stream";

/** Hard cap for the behavioral harness at grade time. Keeps a hung app from
 * blocking finalize; the harness resolves everything past this to inconclusive. */
const BEHAVIORAL_TIMEOUT_MS = 120_000;

export interface EvalRow {
  id: number;
  runId: number | null;
  kind: "metrics" | "judge";
  metrics: RunMetrics | null;
  rubric: (Rubric & { weights: typeof WEIGHTS }) | null;
  score: number | null;
  grade: string | null;
  judgeProvider: string | null;
  gradedAt: number;
}

function upsert(opts: {
  runId: number;
  kind: "metrics" | "judge";
  metrics?: RunMetrics;
  rubric?: Rubric;
  score?: number;
  grade?: string;
  judgeProvider?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO eval_results (run_id, kind, metrics, rubric, score, grade, judge_provider, graded_at)
       VALUES (@runId, @kind, @metrics, @rubric, @score, @grade, @judgeProvider, @gradedAt)
       ON CONFLICT(run_id, kind) DO UPDATE SET
         metrics=@metrics, rubric=@rubric, score=@score, grade=@grade,
         judge_provider=@judgeProvider, graded_at=@gradedAt`
    )
    .run({
      runId: opts.runId,
      kind: opts.kind,
      metrics: opts.metrics ? JSON.stringify(opts.metrics) : null,
      rubric: opts.rubric ? JSON.stringify({ ...opts.rubric, weights: WEIGHTS }) : null,
      score: opts.score ?? null,
      grade: opts.grade ?? null,
      judgeProvider: opts.judgeProvider ?? null,
      gradedAt: Date.now(),
    });
}

/** Layer A: always available, deterministic, free. */
export function gradeRunMetrics(runId: number): RunMetrics | null {
  const run = getRun(runId);
  if (!run) return null;
  const metrics = computeRunMetrics(run);
  upsert({ runId, kind: "metrics", metrics });
  return metrics;
}

/** Layer B: one LLM-judge call, optionally cross-checked by the behavioral
 * validator (spec 0032 / ADR-025). Returns an error string instead of throwing. */
export async function gradeRunWithJudge(
  runId: number
): Promise<{ ok: true; score: number; grade: string } | { ok: false; error: string }> {
  const provider = resolveJudgeProvider();
  if (!provider) return { ok: false, error: "judge provider is none; enable one in settings" };
  const run = getRun(runId);
  if (!run) return { ok: false, error: "run not found" };
  const issue = getIssue(run.issueId);
  const metrics = computeRunMetrics(run);
  const assertions = parseContract(issue?.body ?? "");
  const handoff = parseHandoff(run.worktreePath);

  // Behavioral validation (default off). Runs only when the flag is on AND the
  // contract carries at least one `(e2e)` assertion. The harness never throws
  // and is timeout-bounded, so a hung app cannot block finalize. When skipped,
  // `behavioral` stays undefined and the path is identical to the judge-only one.
  let behavioral: BehavioralResult[] | undefined;
  const e2eAssertions = assertions.filter((a) => a.e2e);
  if (getSettings().evals.behavioralEnabled && e2eAssertions.length > 0) {
    try {
      behavioral = await runBehavioralAssertions(
        run.worktreePath,
        e2eAssertions.map((a) => a.text),
        { timeoutMs: BEHAVIORAL_TIMEOUT_MS }
      );
    } catch (err) {
      // The harness already swallows infra errors to inconclusive; this is belt
      // and braces. A harness fault must never fail the grade.
      console.error(`[evals] behavioral harness threw for run ${runId}:`, err);
      behavioral = undefined;
    }
  }

  const result = runJudge(
    buildJudgePrompt({
      issueTitle: issue?.title ?? "(unknown task)",
      issueBody: issue?.body ?? "",
      metrics,
      transcriptPath: run.transcriptPath,
      assertions,
      handoff,
      behavioral,
    }),
    provider
  );
  if (!result.ok) return result;

  // Reconciliation: a behavioral `fail` is ground truth and overrides the judge
  // verdict for the matching assertion (by exact text). `inconclusive` does not
  // override. After overriding, recompute correctness as the assertion pass
  // fraction and the composite score from the reconciled rubric.
  const rubric = reconcileBehavioral(result.rubric, behavioral);
  const score = compositeScore(rubric);
  const grade = letterGrade(score);
  upsert({ runId, kind: "judge", rubric, score, grade, judgeProvider: provider });
  publish({ kind: "eval.completed", runId, score, grade });
  return { ok: true, score, grade };
}

/**
 * Fold behavioral failures into the judge rubric. For each behavioral result
 * with status "fail", flip the matching rubric assertion (exact text) to
 * `pass: false` and attach the behavioral reason. Then recompute correctness as
 * the pass fraction over the rubric assertions. "inconclusive" never overrides.
 * Returns the rubric unchanged when there is nothing to reconcile.
 */
function reconcileBehavioral(rubric: Rubric, behavioral: BehavioralResult[] | undefined): Rubric {
  if (!behavioral || behavioral.length === 0) return rubric;
  if (!rubric.assertions || rubric.assertions.length === 0) return rubric;

  const failed = new Map(behavioral.filter((b) => b.status === "fail").map((b) => [b.assertion, b.reason] as const));
  if (failed.size === 0) return rubric;

  const assertions = rubric.assertions.map((a) =>
    failed.has(a.text) ? { ...a, pass: false, reason: failed.get(a.text) ?? a.reason } : a
  );
  const passes = assertions.filter((a) => a.pass).length;
  const correctness = Math.round((100 * passes) / assertions.length);
  return { ...rubric, correctness, assertions };
}

/** The persisted judge rubric for a run, or null if it has not been judged. */
export function getJudgeRubric(runId: number): Rubric | null {
  const row = getDb()
    .prepare(`SELECT rubric FROM eval_results WHERE run_id = ? AND kind = 'judge'`)
    .get(runId) as { rubric: string | null } | undefined;
  if (!row?.rubric) return null;
  return JSON.parse(row.rubric) as Rubric;
}

export function listEvals(filters: { projectSlug?: string } = {}): Array<Record<string, unknown>> {
  const clauses = ["1=1"];
  const params: unknown[] = [];
  if (filters.projectSlug) {
    clauses.push("i.project_slug = ?");
    params.push(filters.projectSlug);
  }
  return getDb()
    .prepare(
      `SELECT r.id AS runId, r.agent_slug AS agentSlug, r.runtime_id AS runtimeId, r.exit_status AS exitStatus,
              i.id AS issueId, i.title AS issueTitle, i.project_slug AS projectSlug, i.parent_issue_id AS parentIssueId,
              m.metrics AS metricsJson,
              j.score AS score, j.grade AS grade, j.rubric AS rubricJson, j.judge_provider AS judgeProvider,
              j.graded_at AS gradedAt
       FROM runs r
       JOIN issues i ON i.id = r.issue_id
       LEFT JOIN eval_results m ON m.run_id = r.id AND m.kind = 'metrics'
       LEFT JOIN eval_results j ON j.run_id = r.id AND j.kind = 'judge'
       WHERE r.ended_at IS NOT NULL AND ${clauses.join(" AND ")}
       ORDER BY r.ended_at DESC LIMIT 200`
    )
    .all(...params) as Array<Record<string, unknown>>;
}

/** Finished runs with no judge row yet, oldest last. */
export function ungradedRunIds(limit: number): number[] {
  return (
    getDb()
      .prepare(
        `SELECT r.id FROM runs r
         LEFT JOIN eval_results j ON j.run_id = r.id AND j.kind = 'judge'
         WHERE r.ended_at IS NOT NULL AND j.id IS NULL
         ORDER BY r.ended_at DESC LIMIT ?`
      )
      .all(limit) as Array<{ id: number }>
  ).map((r) => r.id);
}
