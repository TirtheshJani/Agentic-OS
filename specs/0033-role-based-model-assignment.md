# Spec 0033: Role-based model assignment

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-13
**Decision record:** ADR-026 (extends ADR-023)
**Phase:** 12 (compounding quality wave)

Implementation follows the karpathy-guidelines skill.

## Context

ADR-023 registered Antigravity (`agy`) as a third runtime, so the registry can now
express three seats: claude-code, gemini-cli, and antigravity-cli. The Factory
missions talk argues that the validator should run on a different model from the
implementer, because a model grading its own work shares its blind spots
(shared-training bias). Today a run targets one runtime and the ADR-016 judge runs
on whatever the eval path defaults to, so plan, implementation, and validation can
collapse onto a single provider.

The mechanism to thread a model and runtime to a spawn already exists: per-agent
`model` frontmatter flows through `startRun` to the spawn argv and onto the run
row. This spec adds an optional mapping from the three roles (planning,
implementation, validation) to runtimes, defaulting off so current behavior is
preserved, and points the judge at the validation seat when one is configured.

## Decisions (ADR-026)

1. **A role-to-runtime map in settings.** An optional `roleAssignment` block maps
   `plan`, `implement`, and `validate` to a runtime id (or unset). Unset means
   "use today's behavior," so the feature is additive and default off.
2. **The judge honors the validation seat.** When `validate` is set, the ADR-016
   judge and the spec-0026 reflection critique spawn on that runtime instead of the
   default. Unset leaves the eval path unchanged.
3. **Degrade visibly, never silently.** If a mapped runtime is unavailable or
   lacks a needed capability, the path logs the downgrade and falls back to the
   default runtime rather than failing the run. Capability flags from
   `lib/runtime/types.ts` are the gate.
4. **No new spawn mechanism.** Role assignment reuses the existing
   model-and-runtime threading onto the run row; it only chooses which seat a given
   role's spawn targets.

## Files

- `lib/settings.ts`: add the optional default-off `roleAssignment` block
  (`plan` / `implement` / `validate` to runtime id).
- `lib/evals/judge.ts` and `lib/evals/revise.ts`: spawn the judge and revision on
  the `validate` runtime when set; log and fall back when unavailable.
- `lib/startRun.ts`: resolve the `implement` seat (and `plan` where a planning
  spawn exists) from the map, preserving per-agent `model` frontmatter precedence.
- `lib/runtime/` registry: a small helper to resolve a role to an available
  runtime with capability check and fallback.
- `app/settings/` view: surface the role-to-runtime mapping (HITL).

## Acceptance contract

- With `roleAssignment` unset, run spawning and grading are byte-for-byte today's
  behavior (regression guard).
- With `validate` set to an available runtime, the judge spawn targets that
  runtime (asserted on the resolved spawn argv / run row).
- A `validate` runtime that is unavailable or lacks a required capability falls
  back to the default and emits a downgrade log, not a failure.
- Per-agent `model` frontmatter still wins for the implementation seat where both
  are present (precedence guard).
- The settings view round-trips the mapping.

## Acceptance / tests

`tests/role-assignment.test.ts` (new) covers resolution, the unavailable-runtime
fallback, and the frontmatter-precedence guard with a faked registry. Judge tests
gain a case asserting the validation seat is selected when configured.

## Out of scope

Auto-selecting the best model per role (the operator sets the map). A planning
spawn where none exists today (resolve `plan` only where the pipeline already
spawns one). Per-issue role overrides. Cross-provider cost optimization.
