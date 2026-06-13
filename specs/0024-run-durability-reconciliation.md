# Spec 0024: Run durability and boot-time reconciliation

**Status:** Shipped and aligned to ADR-020 (see Resolution note)
**Owner:** TJ
**Date:** 2026-06-12
**Decision record:** ADR-020

Implementation follows the karpathy-guidelines skill.

## Context

`finalizeRunExit` (`lib/startRun.ts`) is the only writer of `runs.ended_at`.
It fires from the in-process `pty.onExit` listener attached at spawn time. A
hard restart, crash, or power loss kills the PTY children and wipes the
`globalThis`-hoisted `liveRuns` Map without that listener completing, so an
interrupted run keeps `ended_at IS NULL`.

That single dangling column triggers three failures that persist across
reboots:

1. **Router deadlock.** `assertCapacity` (`lib/runtime/concurrencyCap.ts`)
   counts every `ended_at IS NULL` row against `perProjectMax` and `globalMax`.
   Enough orphans and the auto-router throws `ConcurrencyCapError` on every
   spawn and holds, so no new run ever starts.
2. **Stuck issue.** The issue was set to `running` in `startRun` and is moved
   out only by `finalizeRunExit`, so it stays `running` forever.
3. **Orphaned worktree.** The per-issue git worktree is left on disk.

ADR-001 (single SQLite writer) and the single-instance localhost design
guarantee the live Map is empty at boot. Any `ended_at IS NULL` row observed at
boot is therefore provably orphaned: its PTY died with the previous process.

## Decisions (ADR-020)

1. **Reconcile on boot, before the router.** `ensureServerBooted`
   (`lib/server-init.ts`) calls a new `reconcileOrphanRuns()` after `openDb()`
   and before `startAutoRouter()`, so capacity is freed before the first sweep.
2. **New `exit_status` value `interrupted`.** Distinct from `failed` so evals
   and analytics do not score a power cut as an agent failure, and so the
   reflection loop (Spec 0026) never triggers on it. `runs.exit_status` is a
   TEXT column with no CHECK constraint, so no migration is needed.
3. **Issue moves to `review`, surfaced in the inbox.** The orphan's issue is
   moved to `review` (already a valid `IssueStatus`). ADR-011's inbox already
   lists issues in review, so the only UI add is an "interrupted" badge driven
   by the issue's latest run `exit_status`. The human chooses resume, requeue,
   or discard.
4. **Worktrees left in place.** Reconciliation does not prune worktrees; partial
   work may be worth inspecting. The existing prune path handles them later.
5. **Reuse the idempotency guard.** Reconciliation routes each orphan through
   the same `ended_at`-guarded write `finalizeRunExit` uses, so a late real
   `onExit` and the reconcile pass cannot double-write.

## Files

- `lib/runs.ts`: widen `UpdateOpts.exitStatus` typing to include
  `"interrupted"`; add `listActiveRuns()` is already present and is the scan
  source.
- `lib/reconcile.ts` (new): `reconcileOrphanRuns(): { reconciled: number }`.
  Scans `listActiveRuns()`; for each, writes `{ endedAt: now, exitStatus:
  "interrupted" }`, moves the issue to `review` via `updateIssue`, appends a
  `run.interrupted` thread event via `lib/threads.ts`, and publishes
  `issue.changed` / `run.finalized` on the existing SSE bus.
- `lib/server-init.ts`: call `reconcileOrphanRuns()` after `openDb()`, before
  `startAutoRouter()`; log the count.
- `lib/startRun.ts`: extract the issue-transition + thread-event side effects
  from `finalizeRunExit` into a small shared helper so reconcile reuses one code
  path (surgical: no behavior change for the normal exit).
- `app/inbox/page.tsx` and the inbox query: show an "interrupted" badge for
  issues whose latest run ended `interrupted`.

## Acceptance / tests

`tests/reconcile.test.ts` (new), following `tests/runLifecycle.test.ts` and
`tests/concurrencyCap.test.ts`:

1. Seed three runs with `ended_at NULL` and their issues `running`. Run
   `reconcileOrphanRuns()`. Assert all three get `exit_status = "interrupted"`,
   `ended_at` set, issues moved to `review`, and a `run.interrupted` thread
   event each.
2. After reconcile, `assertCapacity` no longer throws at the prior cap (capacity
   freed).
3. Idempotency: a second `reconcileOrphanRuns()` is a no-op; a real late
   `onExit` for an already-reconciled run does not overwrite `interrupted`.
4. A genuinely-live run registered in the live Map is not reconciled (guard the
   scan against `listLiveRunIds()` to be safe even though boot has none).

## Out of scope

Auto-requeue of interrupted work (rejected in ADR-020: runs are not
idempotent). Worktree pruning (existing path). Mid-session checkpointing.

## Sync note (2026-06-12)

Commit 538c359 shipped boot reconciliation, so the critical reliability bug is
closed: `reconcileOrphanedRuns()` runs in `ensureServerBooted` before the router,
orphaned runs get `ended_at` set, capacity is freed, and the router can no longer
deadlock on phantom rows. That is the part that mattered most.

It diverges from ADR-020 in three ways, all because the implementation reuses
`finalizeRunExit(run.id, -1)` rather than a dedicated path:

1. Orphans are marked `exit_status = "failed"`, not the distinct `interrupted`
   ADR-020 called for. A restart or power cut now scores as an agent failure.
2. The issue moves to `failed`, not `review`. ADR-020 wanted human-gated triage
   (resume, requeue, or discard), not a state that reads as "the agent broke."
3. There is no inbox "interrupted" flag; `interrupted` exists nowhere in the code.

Recommendation: align the code to ADR-020 with a small follow-up (add an
`interrupted` exit status, branch reconciliation to it, move the issue to
`review`, add the inbox badge), because the distinction keeps evals and analytics
honest about what was an agent failure versus an environment interruption. The
alternative is a conscious amendment to ADR-020 accepting the simpler `failed`
behavior. This is an open decision, not yet resolved.

## Resolution note (2026-06-13)

Resolved in favor of aligning the code to ADR-020 (epic #13, issues #17/#18). The
sync note above is historical; all three divergences are closed:

1. `ExitStatus` now includes `interrupted` (`lib/runs.ts`); reconciliation marks
   orphans `interrupted`, not `failed`.
2. `reconcileOrphanedRuns()` routes orphans through a shared `finalizeRun` helper
   with `("interrupted", "review", ...)`, so the issue moves to `review` for
   human-gated triage (`lib/startRun.ts`).
3. The inbox flags interrupted issues with an "interrupted" badge
   (`app/inbox/page.tsx`), and `lib/evals/autoGrade.ts` gates on
   `exitStatus === "done"`, so neither the judge nor the reflection loop fires on
   an environment interruption.

Covered by `tests/reconcile.test.ts` (interrupted/review, idempotency, late-onExit
no-double-write, thread event, leaves finished runs untouched). Issue #45, filed
to track this alignment, was closed as already-resolved.
