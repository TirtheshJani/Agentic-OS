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

## ADR-006 — Named-agent runs trust handoffs without per-skill opt-in

**Date:** 2026-05-16

**Context.** Phase 6.5 added a `metadata.handoff: true` opt-in so accidental
`next-task:` emissions from ad-hoc skill runs would not fan out. Phase 6.7's
auto-spawn (commit 8179e8a) posts to `/api/run` with `{ prompt, agent,
taskId }` and no `skillSlug`. With no skill in context, the opt-in check in
`/api/run` dropped every handoff with "(adhoc) did not opt in", silently
breaking the multi-agent chain the gate depended on.

**Decision.** When `body.agent` is set on a `/api/run` call (i.e., a named
member agent is running), treat the run as a trusted handoff source and
honor `next-task:` events without requiring `metadata.handoff: true` on the
underlying skill. Ad-hoc skill runs (no `agent` set) still need the opt-in.

**Consequences.** Member agents can chain through whichever skills suit each
task without the skill author having to remember to flip the flag. The
opt-in remains the safety rail for free-form prompt runs from the workbench.
Cost: a member agent that emits a malformed `next-task:` will now enqueue a
bad child task; mitigation is the agent system prompt, not the route.

---

## ADR-007 — Routing matcher uses agent description, not just skill names

**Date:** 2026-05-16

**Context.** The original research-lead matcher scored teammates by
substring-matching `allowed-skills` names against the task prompt. This
worked for prompts that named a skill ("arxiv ML papers" → arxiv-watcher)
but failed open-ended healthcare-policy prompts ("NIH stance on FHIR-RAG")
because no teammate had "NIH" or "FHIR" in any skill name. The gate
exit criteria depended on such routing succeeding.

**Decision.** Lead routing now scores against the teammate's agent profile
`description` (3 points for verbatim domain-term match, 2 for synonym,
1 for skill-name substring). Agent descriptions are deliberately rich in
domain vocabulary (health-watcher names FDA/NIH/FHIR/HIPAA explicitly).
Same rubric applies to content-lead.

**Consequences.** Routing is robust to prompts that don't name a tool.
Cost: each agent description must be curated as a routing signal, not just
human-facing prose. Validator does not enforce this; failures show up as
"no teammate matched — holding" thread notes.

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
