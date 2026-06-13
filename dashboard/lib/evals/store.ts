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
import { publish } from "@/lib/stream";

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

/** Layer B: one LLM-judge call. Returns an error string instead of throwing. */
export function gradeRunWithJudge(runId: number): { ok: true; score: number; grade: string } | { ok: false; error: string } {
  const provider = resolveJudgeProvider();
  if (!provider) return { ok: false, error: "judge provider is none; enable one in settings" };
  const run = getRun(runId);
  if (!run) return { ok: false, error: "run not found" };
  const issue = getIssue(run.issueId);
  const metrics = computeRunMetrics(run);
  const assertions = parseContract(issue?.body ?? "");
  const handoff = parseHandoff(run.worktreePath);

  const result = runJudge(
    buildJudgePrompt({
      issueTitle: issue?.title ?? "(unknown task)",
      issueBody: issue?.body ?? "",
      metrics,
      transcriptPath: run.transcriptPath,
      assertions,
      handoff,
    }),
    provider
  );
  if (!result.ok) return result;

  const score = compositeScore(result.rubric);
  const grade = letterGrade(score);
  upsert({ runId, kind: "judge", rubric: result.rubric, score, grade, judgeProvider: provider });
  publish({ kind: "eval.completed", runId, score, grade });
  return { ok: true, score, grade };
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
