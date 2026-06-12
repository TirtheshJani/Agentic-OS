# Spec 0029: Validation contracts and structured handoffs

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-12
**Decision record:** ADR-022 (amends Spec 0026 / ADR-021)

Implementation follows the karpathy-guidelines skill.

## Context

The ADR-016 judge grades a finished run on a generic correctness, efficiency,
and coherence rubric built from the last few assistant messages, and the
spec-0026 reflection loop revises against that single correctness number. The
Factory missions talk names the weak link directly: correctness defined after
the code confirms decisions instead of catching bugs, and "score 62, try harder"
is a poor instruction to revise against. The fix is a validation contract
written during planning (a definition of done independent of implementation) plus
a structured handoff so the agent records what happened rather than hoping the
next reader infers it.

Two seeds already exist. `issueTemplates.ts` writes ad-hoc "Acceptance:" lines
into issue bodies, and `buildJudgePrompt` already receives the issue body and
already mentions "acceptance criteria" in its instruction. This spec formalizes
both into a parseable contract and wires three consumers to it: the judge, the
reflection loop, and the handoff.

## Decisions (ADR-022)

1. **Contract lives in the issue body.** An optional `## Acceptance contract`
   section holds a checklist of assertions. No new table; it is diffable on the
   kanban and travels with the issue.
2. **Judge grades per assertion, with fallback.** When a contract is present the
   judge returns a pass or fail plus a short reason for each assertion and derives
   `correctness` from the pass fraction; efficiency and coherence and the
   composite weights are unchanged. No contract means the existing generic rubric,
   so nothing regresses.
3. **Structured handoff in the worktree.** Each run writes `HANDOFF.md` by
   absolute path: completed, remaining, commands run with exit codes, issues
   discovered, and a per-assertion self-assessment. `finalizeRunExit` reads it
   before prune, emits a `run.handoff` thread event, and feeds it to the judge.
4. **Reflection loop revises against named assertions.** Spec 0026's revision
   body lists the failed assertions instead of a bare score.

## Files

- `lib/evals/contract.ts` (new): `parseContract(issueBody): Assertion[]` extracts
  the `## Acceptance contract` checklist; returns `[]` when the section is absent.
- `lib/evals/judge.ts`: `buildJudgePrompt` includes the contract assertions and
  the parsed handoff; `RubricSchema` and `parseJudgeReply` gain an optional
  `assertions: [{text, pass, reason}]`; when present, `correctness` is the pass
  fraction. `compositeScore` and `WEIGHTS` are unchanged.
- `lib/evals/store.ts`: persist the `assertions` array inside the existing rubric
  JSON column (no migration).
- `lib/handoff.ts` (new): `parseHandoff(worktreePath): Handoff | null` and the
  `HANDOFF.md` schema doc.
- `lib/startRun.ts`: in the run-finalization path, read `HANDOFF.md` from
  `run.worktreePath` before any prune, append a `run.handoff` thread event, and
  stash the parsed handoff for the judge call.
- `lib/evals/revise.ts` (spec 0026): compose the revision critique from the
  failed assertions.
- `lib/issueTemplates.ts`: emit a starter `## Acceptance contract` stub in
  templated issues.
- `standards/agent-authoring.md` (spec 0028): document that agents write
  `HANDOFF.md` and how to phrase assertions; the agent system prompts reference
  it.

## Acceptance contract

- `parseContract` returns N assertions from a body that has the section and `[]`
  from one that does not.
- With a contract, the judge reply carries per-assertion pass or fail and
  `correctness` equals the pass fraction within rounding.
- With no contract, grading uses the generic rubric unchanged (regression guard).
- `finalizeRunExit` reads `HANDOFF.md`, emits exactly one `run.handoff` thread
  event, and a missing file yields a "no handoff" note without blocking grading.
- A sub-threshold graded run with a contract files a spec-0026 revision whose body
  names the failed assertions.

## Acceptance / tests

`tests/contract.test.ts` and `tests/handoff.test.ts` (new), plus extensions to
the existing eval and reflection-loop tests, covering each bullet above with
injected judge and filesystem fakes (the established eval test pattern).

## Out of scope

The behavioral validator that spawns and exercises the app end to end (the
heavier scrutiny-versus-user-testing split from Factory; a separate future spec,
for which this contract is the input). Vault-file contracts and a dedicated
assertions table (reversals noted in ADR-022). The mission or epic layer above
issues.
