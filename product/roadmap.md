# Roadmap

## Phase 1 — Bootstrap (done)

- Spec layer (`product/`, `standards/`, `instructions/`, `specs/`).
- ~25 spec-compliant skill stubs.
- Vendored `skill-creator` + `karpathy-guidelines`.
- Vault tree.
- Dashboard with SQLite-backed run history and SSE streaming.
- SKILL.md validator.

**Exit criteria:** dashboard renders, validator exits 0, one stub authored
end-to-end as smoke test.

## Phase 2 — Author skill bodies (done)

Use `/new-skill` to fill stubs in priority order:

1. `productivity/daily-rollup` and `productivity/vault-cleanup`
   (low risk, exercises the loop).
2. `research/general/morning-trend-scan` (proves GitHub MCP wiring).
3. `research/physics-ml/arxiv-daily-digest` (proves arXiv API path).
4. `business/inbox-triage` (proves Gmail MCP wiring).
5. `coding/pr-review-prep` (proves GitHub MCP for PRs).
6. The remaining ~20 in any order driven by use.

## Phase 3 — MCP integration polish (done)

- Per-skill `references/<service>-tips.md` capturing rate limits, auth
  patterns, common errors.
- Add `scripts/` deterministic checks (e.g. validate arXiv response shape).

## Phase 4 — Remote scheduled tasks (done)

- Register `automations/remote/*.md` with Claude Code's scheduled-task
  runner.
- Forecast card on the dashboard reflects next-run timestamps.

## Phase 5 — Polish (done)

- Dashboard analytics view (run counts by skill, by domain, by week).
- Vault search card.
- Optional: hook into Spotify/Canva MCPs for content workflows.

## Phase 6 — Wiki promotion & curation

Raw notes accumulate faster than they get distilled. Turn `vault/raw/` into a
reliable source for `vault/wiki/` on a weekly cadence.

- Run the `raw → wiki` promotion workflow at a fixed weekly slot.
- `memory-curator` skill in active use (tags, links, dedupes wiki entries).
- Track promotions per week in the dashboard so the backlog stays visible.

## Phase 7 — Projects layer

`vault/projects/` exists but the dashboard's PROJECTS section in the skills
rail is empty. Make projects a first-class citizen alongside skills.

- `PROJECT.md` in every `vault/projects/<name>/` folder (mirrors SKILL.md shape).
- Surface PROJECTS in the dashboard skills rail (currently empty section).
- Per-project skill scoping: a project can pin which skills are relevant.

## Phase 8 — Skill chaining

One skill calling the outputs of another, deterministically. Start with the
weekly rollup as the reference composition.

- `weekly-rollup` chains `daily-rollup` + `morning-trend-scan` + `inbox-triage`.
- Document the cross-skill composition pattern in `standards/skill-authoring.md`
  (TODO: not edited here — owned by another agent).
- Validator check that chained skills declare each other in `metadata`.

## Phase 9 — Hardening & e2e

Bootstrap is over; the system has enough surface area to need real tests and
discoverability beyond the dashboard.

- Dashboard e2e tests via Playwright (skill run, SSE stream, vault write).
- `/skills` index page listing every authored skill with frontmatter.
- Vault search improvements (full-text, tag facet, recency boost).
- `CLAUDE.md` refresh covering layers added since bootstrap (projects, chaining).
