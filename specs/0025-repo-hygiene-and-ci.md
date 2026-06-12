# Spec 0025: Repo hygiene and CI

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-12
**Decision record:** none (no architectural decision; cleanup + automation)

Implementation follows the karpathy-guidelines skill.

## Context

Two reliability-supporting gaps, neither needing an ADR.

First, `docs/Claude-Control-Center-main` is a 6.2M nested project (its own
frontend, backend, `CONTEXT.md`, and lockfiles) vendored under `docs/`. It
duplicates the dashboard's concern, confuses tree navigation, and was flagged in
the original planning docs. It is reference material, not a build input.

Second, the repo has 51 vitest test files plus `validate:skills` and
`validate:automations` scripts, but nothing runs them automatically. There is no
`.github/workflows`. Regressions in run lifecycle, concurrency, migrations, or
skill-frontmatter compliance are caught only when someone runs `npm test`
locally.

## Decisions

1. **Extract, do not delete, the nested repo.** Move
   `docs/Claude-Control-Center-main` out of the working tree (it survives in git
   history). If specific files are still wanted as reference, keep only those
   under `references/`. This matches ADR-012's companion-cleanup precedent
   (`dashboard-v1/` was removed from the tree, kept in history).
2. **Add CI that runs what already exists.** One GitHub Actions workflow on push
   and pull_request: Node 22, `npm ci` in `dashboard/`, then `npm run lint`,
   `npm test`, `npm run validate:skills`, `npm run validate:automations`, and
   `npm run build`. No new test framework, no coverage gate yet (the existing
   suite is the contract).
3. **No behavior change in app code.** This spec touches the repo tree and CI
   config only.

## Files

- Remove `docs/Claude-Control-Center-main/` from the tree (git `mv` or `rm`;
  history retains it).
- `.github/workflows/ci.yml` (new): the job described above, `working-directory:
  dashboard` where relevant.
- `README.md`: drop the line implying the nested folder is part of the repo, if
  present.

## Acceptance / tests

1. `find . -path ./.git -prune -o -name node_modules -prune -o -type f -print`
   no longer lists `docs/Claude-Control-Center-main`.
2. The workflow runs green on a clean checkout: lint, the full vitest suite, both
   validators, and `next build` all pass.
3. A deliberately broken skill frontmatter fails CI via `validate:skills`
   (smoke-check the gate works).

## Out of scope

Coverage thresholds, release automation, branch protection rules, and any
dependency upgrades. Those are separate decisions if wanted later.
