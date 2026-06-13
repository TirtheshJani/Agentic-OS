# Spec 0031: Domain glossary and intent injection

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-13
**Decision record:** ADR-024
**Phase:** 12 (compounding quality wave)

Implementation follows the karpathy-guidelines skill.

## Context

ADR-007 routing scores an issue against each agent's `description`, and spec 0028
enriched those descriptions with domain vocabulary so a skill-free prompt still
lands on the right lead. The Factory missions talk frames the remaining gap as a
ubiquitous-language problem from domain-driven design: agents and operator drift
on what a term means ("run" vs "session", "issue" vs "task", "epic" vs "mission"),
and a task that omits its "why" forces the agent to guess intent. The roadmap
calls a shared glossary plus a per-task why line "the cheapest precision win."

This spec folds both into the spec-0028 agent-context injection rather than
standing up new machinery. A single source-of-truth glossary is authored once,
parsed into the context the agent already receives at spawn, and reused by the
router so an alias scores the same as the canonical term.

## Decisions (ADR-024)

1. **One glossary source of truth.** `product/glossary.md` holds the terms. Each
   entry is a canonical term, a one-line definition, and optional comma-separated
   aliases. Markdown so it diffs on review and indexes into the vault like other
   docs. No new table.
2. **Inject the glossary into agent context at spawn.** The spawn-time context
   assembly that already carries project knowledge prepends a compact glossary
   block, capped to a character budget so it never crowds the task. Parsed once
   and cached; a malformed line is skipped, not fatal.
3. **A task carries its why.** Issue templates gain a `## Why` one-liner (the
   intent behind the task). It is optional and degrades to today's behavior when
   absent, and when present it is surfaced to the agent alongside the task body.
4. **Routing credits glossary aliases.** ADR-007 scoring treats a glossary alias
   as equivalent to its canonical term when matching an issue against agent
   descriptions, so vocabulary drift no longer costs a routing hit.

## Files

- `product/glossary.md` (new): the term/definition/aliases source.
- `lib/glossary.ts` (new): `parseGlossary(md): GlossaryTerm[]` and
  `glossaryContextBlock(terms, budget): string`; returns `[]` / `""` on an absent
  or malformed file.
- `lib/startRun.ts`: prepend `glossaryContextBlock(...)` to the assembled agent
  context, inside the existing prompt budget.
- `lib/orchestrator/` (ADR-007 scorer): expand each agent-description match set
  with glossary aliases so an alias scores as the canonical term.
- `lib/issueTemplates.ts`: emit an optional `## Why` line in templated issues and
  thread it into the run context.
- `standards/agent-authoring.md` (spec 0028): document the glossary as shared
  vocabulary and that agents may rely on it.

## Acceptance contract

- `parseGlossary` returns N terms from a well-formed file and `[]` from a missing
  or empty one; a malformed entry is skipped without throwing.
- `glossaryContextBlock` never exceeds the configured character budget.
- A spawned run's context contains the glossary block when `product/glossary.md`
  exists and is unchanged from today when it does not (regression guard).
- An issue whose text uses only a glossary alias routes to the same lead agent as
  one using the canonical term (router test).
- A `## Why` line in an issue body reaches the agent context; its absence changes
  nothing.

## Acceptance / tests

`tests/glossary.test.ts` (new) covers parse, budget, and the absent-file
regression guard; the orchestrator routing test gains an alias-equivalence case.
Injected fixtures only, following the established lib test pattern.

## Out of scope

A glossary editor UI (author the markdown directly for now). Cross-agent term
analytics. Auto-extracting terms from the codebase. The glossary does not gate or
block a run; it only enriches context and routing.
