# Spec 0026: Reflection loop via judge-triggered revision

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-12
**Decision record:** ADR-021

Implementation follows the karpathy-guidelines skill.

## Context

ADR-016 / Spec 0020 already grade finished runs with an LLM judge. On
`run.finalized`, `startEvalAutoGrade` (`lib/evals/autoGrade.ts`) computes free
deterministic metrics, then, only when `evals.autoGradeEnabled` and the global
`autonomy.enabled` switch are both on and the run exited `done`, calls
`gradeRunWithJudge` (`lib/evals/store.ts`), which returns a composite 0-100 score
and an A-F letter.

Today that grade is only recorded. Agents do not self-correct. The roadmap's
reflection loop was designed in the planning docs as "intercept stdout, loop
`max_retries=2`," which assumes a parseable headless pipeline. ADR-010 deprecated
that in favor of PTY runs and HTTP handoffs, so the stdout design does not fit.
A handoff already exists: a revision is just a new queued issue with a parent
link.

## Decisions (ADR-021)

1. **Trigger on a sub-threshold judged score, behind the existing double gate.**
   In the `run.finalized` handler, after `gradeRunWithJudge` returns `ok`, if
   `score < settings.evals.reviseThreshold`, file one revision task. No new gate:
   it inherits ADR-016's `autoGradeEnabled` + `autonomy.enabled`, so it is off by
   default and never fires during manual or batch grading.
2. **One revision round, then escalate.** The revision is a new issue created via
   the existing issue mutation path: `status: "queued"`, `parentIssueId` set to
   the graded issue, `assigneeSlug` set to the same agent, body = the critique
   plus a short "revise to address the following" preamble. When the issue carries
   an acceptance contract (Spec 0029 / ADR-022), the critique is the list of
   failed assertions; otherwise it is the judge's rubric rationale. The
   round cap reuses the ADR-010 parent-chain-depth mechanism: a revision whose
   parent is already a revision is not created; instead the original issue is
   moved to `review`. So at most one auto-revision per issue.
3. **Only revisable runs qualify.** `interrupted` (Spec 0024) and `failed` runs
   never trigger a revision; the trigger sits on the `exitStatus === "done"`
   branch that already guards the judge call.
4. **New setting `evals.reviseThreshold`.** Number, default `70` (a C grade).
   Added to the evals settings schema next to `judgeProvider`, `autoGradeEnabled`,
   `batchLimit`. A revision-loop master toggle is unnecessary: setting the
   threshold to `0` disables it.

## Files

- `lib/settings.ts`: add `reviseThreshold: z.number().int().min(0).max(100)
  .default(70)` to the evals schema and defaults.
- `lib/evals/autoGrade.ts`: after the `gradeRunWithJudge` call, when the result
  is `ok` and `score < reviseThreshold`, call a new `lib/evals/revise.ts`
  helper. Keep the handler thin.
- `lib/evals/revise.ts` (new): `fileRevision(runId, judgeResult)`: resolves the
  run's issue, checks parent-chain depth (skip + escalate to `review` if the
  parent is already a revision), composes the critique body from the stored
  rubric, and creates the queued child issue via the existing issue mutation
  utility. Emits a `revision.filed` thread event.
- `app/settings/page.tsx` and `app/evals/page.tsx`: expose `reviseThreshold`;
  show a "revision" lineage marker on issues that came from a judge revision.

## Acceptance / tests

`tests/reflectionLoop.test.ts` (new), with an injected judge fake:

1. Gates off: with `autoGradeEnabled` or `autonomy` off, a low score files no
   revision.
2. Gates on, `score < reviseThreshold`: exactly one queued child issue is
   created with `parentIssueId` set, assigned to the same agent, body carrying
   the critique; a `revision.filed` event is appended.
3. Round cap: a low score on an issue that is itself a revision files no second
   revision and moves the original to `review`.
4. `score >= reviseThreshold`: no revision.
5. `interrupted` / `failed` runs: no judge call, no revision.

## Out of scope

Multi-round revision (cap is one; reversal noted in ADR-021 via a future
`evals.maxRevisionRounds`). Blending judged scores into deterministic metrics
(ADR-016 keeps them separate). A bespoke reviewer agent (the judge is the
critic).
