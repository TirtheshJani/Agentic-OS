# Decisions (ADR-style log)

Append-only. Each entry: number, title, date, context, decision,
consequences.

---

## ADR-001 — SQLite over JSONL for run history

**Date:** 2026-05-10

**Context.** Run history needs to power a "recent runs" card, a forecast of
upcoming scheduled tasks, and (later) an analytics view. JSONL appends
quickly but every read scans the whole file.

**Decision.** Use `better-sqlite3` with a single DB file at
`.agentic-os/state.db`. Tables: `runs`, `vault_changes`, `schedules`.
Migrations run on dashboard boot.

**Consequences.** One process at a time can write (sync API). Acceptable
because the dashboard is the only writer. The DB file is gitignored.

---

## ADR-002 — Laptop-only host, no cron

**Date:** 2026-05-10

**Context.** A reliable "always-on" laptop is not available, and managing
launchd/cron across machines is friction.

**Decision.** Local automations are shell scripts you invoke when the
laptop is open (`automations/local/*.sh`). Recurring 24/7 work goes to
**Claude Code scheduled tasks**, defined as markdown specs under
`automations/remote/*.md`.

**Consequences.** No background daemon to maintain locally. Forecast card
in the dashboard reads `automations/remote/*.md` to display upcoming runs.

---

## ADR-003 — Skills as folders, not single files

**Date:** 2026-05-10

**Context.** A SKILL.md alone limits us to ≤500 lines and forces every
helper into prose. Anthropic's spec already supports `scripts/`,
`references/`, `assets/`.

**Decision.** Every skill is a folder. SKILL.md stays under the soft cap;
deeper detail moves to `references/*.md`; deterministic checks live in
`scripts/`; templates live in `assets/`.

**Consequences.** Slight overhead per skill (one folder vs. one file).
Worth it for progressive disclosure and cleaner diffs.

---

## ADR-004 — Vendor `skill-creator` and `karpathy-guidelines` rather than
re-implement

**Date:** 2026-05-10

**Context.** Anthropic publishes a production skill-creator. forrestchang
publishes a battle-tested behavioral guidelines skill. Re-deriving either
would drift over time.

**Decision.** Clone both into `skills/_meta/` verbatim at bootstrap.
`/new-skill` and `/karpathy` slash commands invoke them. Provenance
(upstream URL + commit SHA at clone time) is recorded in this file when the
clone runs.

**Consequences.** Upstream changes do not auto-update; we re-vendor on
demand. Acceptable — both upstreams are stable.

**Provenance:**

- `skills/_meta/skill-creator/` ← [`anthropics/skills`](https://github.com/anthropics/skills)
  @ `f458cee31a7577a47ba0c9a101976fa599385174` (cloned 2026-05-10).
- `skills/_meta/karpathy-guidelines/` ← [`forrestchang/andrej-karpathy-skills`](https://github.com/forrestchang/andrej-karpathy-skills)
  @ `2c606141936f1eeef17fa3043a72095b4765b9c2` (cloned 2026-05-10).
- `template/SKILL.md` ← `anthropics/skills/template/SKILL.md` @ same SHA as
  `skill-creator` above.

To re-vendor: clone the upstream, copy the subtree, update the SHA above,
commit. No automated sync — that's intentional (see decision body).

---

## ADR-005 — Strict Anthropic Skills spec compliance

**Date:** 2026-05-10

**Context.** Skills shipped non-compliantly drift from Claude Code's
expectations and from any future Skills marketplace. Custom top-level
frontmatter fields ("trigger", "domain", "mode") would be invisible to the
spec parser.

**Decision.** Top-level frontmatter is restricted to `name`, `description`,
`license`, `allowed-tools`, `metadata`. Custom keys live under `metadata`.
A validator script (`dashboard/scripts/validate-skills.mjs`) enforces this
on every build.

**Consequences.** All ~25 stub skills pass the spec validator from day one.
Cost: dashboard has to read `metadata.status`/`metadata.domain` instead of
the top level. Negligible.

---

## ADR-006 — Roadmap phases 6–9 added

**Date:** 2026-05-15

**Context.** Phases 1–5 are done. The system has grown beyond bootstrap:
raw notes are accumulating without a promotion cadence, the projects layer
is unused in the dashboard, and skills are starting to want to call each
other. Without an explicit roadmap these tracks would drift.

**Decision.** Append four phases — wiki promotion & curation (6), projects
layer (7), skill chaining (8), hardening & e2e (9) — to `product/roadmap.md`
with concrete deliverables. Mark phases 1–5 as done.

**Consequences.** Future work has named buckets; agents can claim a phase
without coordination. Standards work for chaining (Phase 8) is flagged as a
TODO against `standards/skill-authoring.md`, owned by a different agent.
