# Spec 0032: Behavioral end-to-end validator

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-13
**Decision record:** ADR-025 (consumes Spec 0029 / ADR-022)
**Phase:** 12 (compounding quality wave)

Implementation follows the karpathy-guidelines skill.

## Context

Spec 0029 put a validation contract in the issue body and had the ADR-016 judge
grade each assertion. The judge still infers pass or fail from the transcript and
the diff; it never runs the app. The Factory missions talk names this the
scrutiny-versus-user-testing split: reading the work is scrutiny, exercising it
is user testing, and only the second catches a feature that looks right in the
diff but is broken in the browser. Spec 0029 explicitly left this validator as a
separate future spec and named its own contract as the input. This is that spec.

The pieces already exist. The vendored `playwright-skill` can launch a dev server
and drive a browser, and the dashboard has a known launch path (`npm run dev` via
`server.ts`). The contract assertions from `parseContract` are the checklist to
verify. The work is a harness that, for the behavioral assertions in a contract,
drives the running app and reports per-assertion pass or fail, wired into the same
finalize path that already grades the run.

## Decisions (ADR-025)

1. **Behavioral assertions are a marked subset of the contract.** An assertion the
   validator can exercise is tagged in the `## Acceptance contract` checklist (for
   example a trailing `(e2e)` marker). Unmarked assertions stay judge-only, so
   nothing about spec 0029 regresses.
2. **The validator drives the app via the Playwright skill.** A harness launches
   the app against the run's worktree, runs the marked assertions as browser
   steps, and emits a per-assertion pass or fail with a short reason and an
   optional screenshot path. Failures are captured, never thrown past the harness.
3. **Feature-flagged, default off.** A `behavioralValidator` settings flag gates
   the whole path; when off, grading is exactly today's spec-0029 behavior. The
   harness has a hard timeout so a hung app cannot wedge finalize.
4. **Results feed the judge, not replace it.** Behavioral pass or fail is passed
   to `buildJudgePrompt` alongside the transcript assessment; the judge reconciles
   them into the existing per-assertion `correctness`. A marked assertion that the
   harness could not run is reported as inconclusive, not failed.

## Files

- `lib/evals/behavioral.ts` (new): `runBehavioralAssertions(worktreePath,
  assertions, opts): BehavioralResult[]` driving the app via the Playwright skill;
  honors a timeout and returns inconclusive on launch failure.
- `lib/evals/contract.ts` (spec 0029): `parseContract` tags each assertion with an
  `e2e` boolean from the marker.
- `lib/evals/judge.ts`: `buildJudgePrompt` includes behavioral results; the
  per-assertion reconciliation treats a behavioral fail as failing regardless of
  transcript inference.
- `lib/startRun.ts`: in finalize, when the flag is on and behavioral assertions
  exist, run the harness before the judge call and stash results for grading.
- `lib/settings.ts`: add the default-off `behavioralValidator` flag.
- `app/` run/eval detail view: surface behavioral pass or fail and screenshot
  links per assertion.

## Acceptance contract

- `parseContract` tags an `(e2e)`-marked assertion as behavioral and leaves others
  judge-only.
- With the flag off, finalize and grading are byte-for-byte today's behavior
  (regression guard).
- With the flag on and a marked assertion, the harness emits a pass or fail with a
  reason; a launch failure yields inconclusive, never an unhandled throw.
- The harness respects its timeout and finalize completes even when the app hangs.
- A behavioral fail forces that assertion's `correctness` contribution to fail in
  the judge reconciliation.
- The run/eval view shows per-assertion behavioral status. (e2e)

## Acceptance / tests

`tests/behavioral.test.ts` (new) with a faked Playwright driver and a faked clock
covers pass, fail, inconclusive-on-launch-failure, and timeout. Judge
reconciliation tests gain a behavioral-fail-overrides case. No real browser in CI;
the driver is injected.

## Out of scope

Authoring browser steps for arbitrary natural-language assertions (the marker
scopes the validator to assertions written to be driven). Visual-regression
diffing. Running the validator outside the run-finalize path. Non-dashboard apps
(the harness targets this project's known launch path first).
