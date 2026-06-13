// dashboard/lib/evals/revise.ts
// Reflection loop (spec 0026 / ADR-021). When a judged run scores below
// evals.reviseThreshold, file exactly one revision child issue for the same
// agent. Capped at one round via the ADR-010 parent-chain-depth mechanism: a
// run whose issue is itself a revision escalates to `review` instead of looping.
import { getRun } from "@/lib/runs";
import { getIssue, createIssue, updateIssue, chainDepth } from "@/lib/issues";
import { getJudgeRubric } from "@/lib/evals/store";
import { appendEvent } from "@/lib/threads";
import { publish } from "@/lib/stream";
import type { Rubric } from "@/lib/evals/judge";

export type RevisionResult =
  | { ok: true; revisionIssueId: number }
  | { ok: true; escalated: true }
  | { ok: false; reason: string };

/** Critique body: failed acceptance assertions when present, else the rationale. */
function critiqueBody(rubric: Rubric): string {
  const failed = (rubric.assertions ?? []).filter((a) => !a.pass);
  if (failed.length > 0) {
    const lines = failed.map((a) => `- ${a.text}${a.reason ? ` (${a.reason})` : ""}`);
    return `Revise to address the following failed acceptance checks:\n\n${lines.join("\n")}`;
  }
  const rationale = rubric.rationale.trim() || "The judge scored this run below the revision threshold.";
  return `Revise to address the following judge feedback:\n\n${rationale}`;
}

/**
 * File one revision for a sub-threshold judged run. Caller is responsible for
 * the gates (autoGradeEnabled + autonomy.enabled) and the score comparison.
 */
export function fileRevision(runId: number): RevisionResult {
  const run = getRun(runId);
  if (!run) return { ok: false, reason: "run not found" };
  const issue = getIssue(run.issueId);
  if (!issue) return { ok: false, reason: "issue not found" };

  // One revision round per issue: if the graded issue is itself a revision
  // (it descends from a parent), escalate to review rather than looping.
  if (chainDepth(issue.id) >= 1) {
    updateIssue(issue.id, { status: "review" });
    appendEvent({
      projectSlug: issue.projectSlug,
      issueId: issue.id,
      eventType: "revision.escalated",
      details: `Run ${runId} graded below the revision threshold again; this issue is already a revision, so escalating to review for a human.`,
    });
    publish({ kind: "revision.escalated", runId, issueId: issue.id, projectSlug: issue.projectSlug });
    publish({ kind: "issue.changed", id: issue.id, projectSlug: issue.projectSlug, reason: "status" });
    console.info(`[evals] run ${runId}: revision cap reached for issue ${issue.id}; escalated to review`);
    return { ok: true, escalated: true };
  }

  const rubric = getJudgeRubric(runId);
  if (!rubric) return { ok: false, reason: "no judge rubric for run" };

  const revisionIssueId = createIssue({
    projectSlug: issue.projectSlug,
    title: `Revision: ${issue.title}`,
    body: critiqueBody(rubric),
    assigneeSlug: issue.assigneeSlug,
    status: "queued",
    mode: issue.mode,
    priority: issue.priority,
    labels: issue.labels,
    parentIssueId: issue.id,
  });

  appendEvent({
    projectSlug: issue.projectSlug,
    issueId: issue.id,
    eventType: "revision.filed",
    details: `Run ${runId} graded below the revision threshold; filed revision issue ${revisionIssueId} for the same agent.`,
  });
  publish({ kind: "revision.filed", runId, issueId: issue.id, revisionIssueId, projectSlug: issue.projectSlug });
  publish({ kind: "issue.changed", id: revisionIssueId, projectSlug: issue.projectSlug, reason: "create" });
  console.info(`[evals] run ${runId}: filed revision issue ${revisionIssueId} (parent ${issue.id})`);
  return { ok: true, revisionIssueId };
}
