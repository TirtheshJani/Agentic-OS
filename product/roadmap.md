# Roadmap

## Phase 1 — Bootstrap (this PR)

- Spec layer (`product/`, `standards/`, `instructions/`, `specs/`).
- ~25 spec-compliant skill stubs.
- Vendored `skill-creator` + `karpathy-guidelines`.
- Vault tree.
- Dashboard with SQLite-backed run history and SSE streaming.
- SKILL.md validator.

**Exit criteria:** dashboard renders, validator exits 0, one stub authored
end-to-end as smoke test.

## Phase 2 — Author skill bodies

Use `/new-skill` to fill stubs in priority order:

1. `productivity/daily-rollup` and `productivity/vault-cleanup`
   (low risk, exercises the loop).
2. `research/general/morning-trend-scan` (proves GitHub MCP wiring).
3. `research/physics-ml/arxiv-daily-digest` (proves arXiv API path).
4. `business/inbox-triage` (proves Gmail MCP wiring).
5. `coding/pr-review-prep` (proves GitHub MCP for PRs).
6. The remaining ~20 in any order driven by use.

## Phase 3 — MCP integration polish

- Per-skill `references/<service>-tips.md` capturing rate limits, auth
  patterns, common errors.
- Add `scripts/` deterministic checks (e.g. validate arXiv response shape).

## Phase 4 — Remote scheduled tasks

- Register `automations/remote/*.md` with Claude Code's scheduled-task
  runner.
- Forecast card on the dashboard reflects next-run timestamps.

## Phase 5 — Polish

- Dashboard analytics view (run counts by skill, by domain, by week).
- Vault search card.
- Optional: hook into Spotify/Canva MCPs for content workflows.
