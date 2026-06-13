# Spec 0034: Mission and epic layer

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-13
**Decision record:** ADR-027
**Phase:** 12 (compounding quality wave)

Implementation follows the karpathy-guidelines skill.

## Context

The board today is a flat list of issues; an initiative that spans several issues
lives only in TJ's head and in `next-task` handoff chains. The Factory missions
talk frames the missing tier as the "orders of magnitude harder tasks" unlock: a
mission (or epic) sits above issues, owns a shared contract and a milestone, and
sequences its children so dependent work runs in order while independent work runs
in parallel. Spec 0029 named the epic layer as out of its scope, and ADR-010's
HTTP handoff chain (capped by `maxChainDepth`) is the existing primitive for one
issue spawning another, but there is no first-class object that groups them or
rolls their grades up.

This spec adds that object. It is the largest of the Phase 12 wave and reuses the
existing SQLite issues machinery, the orchestrator/auto-router, and the kanban
rather than introducing a parallel system. It also forces the serial-versus-
parallel execution fork the roadmap parked; this spec takes the parked default
(parallel across independent children, serial within a dependent set).

## Decisions (ADR-027)

1. **Epics are a first-class table with issue linkage.** An `epics` table (title,
   why, shared contract, milestone, status) and an `epic_id` plus optional
   `depends_on` on issues. A migration in `lib/db.ts`; no rewrite of the issues
   schema.
2. **The epic owns a shared contract and a rollup grade.** Child-issue acceptance
   contracts (spec 0029) and grades aggregate to an epic-level status: an epic is
   done when every child passes its contract. The rollup is derived, not stored
   twice.
3. **The router respects dependency order.** A child with an unmet `depends_on`
   is not eligible for routing; independent children of the same epic may run
   concurrently up to the existing capacity cap. This is the parked
   parallel-across-independent, serial-within-dependent default.
4. **Optional GitHub milestone mapping.** An epic may map to a GitHub milestone
   (the repo has none today) so the board and GitHub stay aligned; mapping is
   opt-in and the epic works without it.

## Files

- `lib/db.ts`: migration adding the `epics` table and `epic_id` / `depends_on`
  columns on issues (additive, applied on boot like existing migrations).
- `lib/epics.ts` (new): CRUD plus `rollupStatus(epicId)` deriving epic status from
  child contracts and grades, and `eligibleChildren(epicId)` filtering on
  `depends_on`.
- `lib/orchestrator/`: the auto-router excludes children with unmet dependencies
  and otherwise treats eligible children as normal issues.
- `app/` epics view (HITL): a missions surface above the kanban showing each epic,
  its children, dependency order, and rollup status.
- `lib/issueTemplates.ts`: allow creating an issue under an epic with a
  `depends_on` reference.
- Optional `lib/github` hook: map an epic to a milestone when configured.

## Acceptance contract

- The migration adds the `epics` table and the new issue columns and is idempotent
  on a second boot.
- `rollupStatus` reports done only when every child passes its contract and
  in-progress otherwise; an epic with no children is empty, not done.
- `eligibleChildren` excludes any child with an unmet `depends_on` and includes
  independent children.
- The router does not pick a child whose dependency is unmet and does pick its
  independent siblings (router test).
- The epics view renders an epic with children, dependency order, and rollup
  status, and degrades cleanly with zero epics. (e2e)
- An epic with no milestone mapping functions fully (mapping is optional).

## Acceptance / tests

`tests/epics.test.ts` (new) covers the migration idempotency, `rollupStatus`, and
`eligibleChildren`; orchestrator tests gain a dependency-gating case. The view is
HITL-reviewed. Faked db and router fixtures per the established pattern.

## Out of scope

Auto-decomposing a mission into issues (the operator or a planning agent writes the
children). Cross-epic dependencies. Gantt or timeline visualization. Resolving the
prompt-driven-versus-deterministic-orchestration fork (this spec stays
deterministic). Nested epics.
