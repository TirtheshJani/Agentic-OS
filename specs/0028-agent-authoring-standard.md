# Spec 0028: Agent authoring standard, validator, and description enrichment

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-12
**Decision record:** none new (implements ADR-005 and ADR-007)

Implementation follows the karpathy-guidelines skill.

## Context

Skills and automations each have an authoring standard (`standards/
skill-authoring.md`, `standards/automation-authoring.md`) and a validator
(`scripts/validate-skills.mjs`, `scripts/validate-automations.mjs`). Agents have
neither. The 13 profiles in `agents/*.md` range from 22 to 51 lines and drift in
structure.

The sharper problem is routing. ADR-007 scores teammates against the agent
profile `description` (verbatim domain-term match scores highest), so the
`description` field is a routing signal, not just prose. Some descriptions carry
rich domain vocabulary (health-watcher names FDA, NIH, FHIR, HIPAA); others are
generic (research-lead: "Routes research tasks to the right teammate based on
skill overlap"), which weakens routing for prompts that do not name a skill.

The planning docs proposed rewriting every prompt into rigid XML. That is the
wrong tool: it risks pulling routing vocabulary out of `description` into an XML
body the matcher never reads, breaking ADR-007. The fix is a standard, a
validator, and targeted description enrichment.

## Decisions

1. **Add `standards/agent-authoring.md`.** Modeled on `skill-authoring.md`.
   Defines required frontmatter (the ADR-005 spec keys plus the agent fields
   already in use: `slug`, `runtime`, `skills`, `created`), the `# System Prompt`
   body structure (role, operating procedure, available teammates or tools,
   stop condition), and an explicit rule that `description` must carry the
   agent's domain vocabulary because routing depends on it (ADR-007). No
   mandated rigid XML; structure is by markdown sections.
2. **Add `scripts/validate-agents.mjs` and a `validate:agents` npm script.**
   Checks: frontmatter restricted to allowed keys (ADR-005 parity), required
   fields present, `slug` matches filename, referenced `skills` exist, and a
   lint warning when a `description` is shorter than a floor or contains none of
   the agent's declared domain terms (a routing-health heuristic, warning not
   error). Wired into CI (Spec 0025).
3. **Enrich the thin descriptions.** Update the profiles whose descriptions are
   generic (research-lead first, then any others the validator flags) to name
   their domain vocabulary, following the health-watcher pattern. This is a
   content edit to the `description` field only; system-prompt bodies are left
   alone unless they violate the new standard.
4. **No behavior change to the matcher.** ADR-007's routing code is unchanged;
   this spec only improves the data it reads and adds a guard.

## Files

- `standards/agent-authoring.md` (new).
- `scripts/validate-agents.mjs` (new); `validate:agents` script in
  `dashboard/package.json`; add it to the CI job in `.github/workflows/ci.yml`.
- `agents/research-lead.md` and any validator-flagged profiles: enrich
  `description` only.

## Acceptance / tests

1. `npm run validate:agents` passes on the current tree after enrichment, and
   fails on a deliberately malformed profile (bad frontmatter key, missing
   slug).
2. The routing-health heuristic warns on a stub description and is quiet after
   enrichment.
3. An ADR-007 routing test (extend the existing routing test) confirms an
   open-ended prompt that names no skill now routes to the enriched agent.

## Out of scope

Rigid XML prompt templates (rejected above). Rewriting system-prompt bodies
wholesale. Changing the routing algorithm or its weights (ADR-007 stands).
