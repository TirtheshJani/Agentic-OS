# Spec 0020 — Evals

**Status:** Shipped
**Owner:** TJ
**Date:** 2026-06-11
**Decision record:** ADR-016

Implementation follows the karpathy-guidelines skill.

## Context

Agent runs finish and land in review with no quality signal beyond exit code. TJ wants graded sessions (the Claude-Control-Center eval pattern, cwc-workshops eval-driven development) without burning LLM quota silently.

## Decisions (ADR-016)

1. **Two strictly separated layers.** Layer A (deterministic, free, always on): duration, exit status, turns/tool-calls/tokens joined from the spec-0018 `sessions` table, `git diff --shortstat` only while the worktree still exists. Computed automatically on every `run.finalized` event. Layer B (LLM judge): rubric correctness 0.4 / efficiency 0.3 / coherence 0.3 → composite 0-100 → A≥90..F. Deterministic metrics are displayed alongside but never folded into the judged score (mixing invites false precision).
2. **Judge routes through the spec-0013 answer provider** (`evals.judgeProvider: "inherit"` follows `rag.answerProvider`; gemini-cli default, claude-cli explicit opt-in, none disables). One call per grade, never looped or retried — the same credit policy as agent drafting.
3. **Manual-first, auto double-gated.** Grade buttons and a sequential batch endpoint are the primary path. Auto-judging requires `evals.autoGradeEnabled` (default false) AND the global autonomy switch, and only fires for clean exits.
4. **Judge input is bounded** (24k chars): issue title/body + run metrics + the last assistant messages from the transcript — never the whole transcript.
5. **Re-grades replace** (UNIQUE(run_id, kind) upsert); no grade history. Noted limit.

## Files

`lib/evals/metrics.ts` (Layer A), `lib/evals/judge.ts` (prompt builder, rubric zod parse via `lib/llm/extractJson`, composite/letter helpers), `lib/evals/store.ts` (upserts, list, ungraded query), `lib/evals/autoGrade.ts` (run.finalized listener, started in ensureServerBooted). Migration V8 `eval_results`. Stream event `eval.completed`.

## API

- `GET /api/evals?project=` → finished runs joined with metrics + judge rows (200 cap)
- `POST /api/evals/grade {runId}` → metrics + judge; 409 when provider is none, 502 on judge failure
- `POST /api/evals/grade {batch: true}` → sequential judge over up to `evals.batchLimit` ungraded runs (stops early if the provider is none)

## UI

`/evals`: grade-distribution bars, finished-run table (metrics summary, A-F chip with rationale tooltip, labeled "subjective"), per-run Grade/Re-grade, batch button. Nav entry after Analytics. Settings UI for the evals block is pending (settings page section deferred; the API accepts the block — documented limitation).

## Tests

`tests/evals.test.ts` — composite/letter math, bounded prompt, invalid-reply rejection, metrics-without-CLI, judge upsert-replace, provider-none error, ungraded listing, and the double-gating test (default → metrics only, zero CLI calls; both switches on → exactly one judge call). CLI module mocked; unique state dir per test to avoid settings leakage. `tests/db.test.ts` bumped to V8.

## Limitations

- Session-path grading (CLI sessions without runs) is schema-supported but has no endpoint yet.
- Tool-error rate omitted (tool_result error flags not parsed yet).
- No grade history.
