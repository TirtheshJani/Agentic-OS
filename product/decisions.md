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

---

## ADR-005 — Skill frontmatter restricted to spec keys

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

## ADR-008 — Gemini CLI replaces Codex as the second runtime

**Date:** 2026-06-10

**Context.** Spec 0006 (D9) locked Codex as the second runtime, chosen for
paradigm similarity and abstraction stress-testing. Since then the operator
confirmed two paid plans to put to work: Claude Max (drives claude-code via
the logged-in CLI) and Google AI Pro (raises Gemini CLI limits via personal
Google OAuth). Codex would require a third subscription with no existing
entitlement. Gemini CLI v0.46.0 verified locally: interactive TUI under a
PTY like claude-code, `--yolo` auto-approval, `--skip-trust` suppresses the
workspace trust dialog, `--session-id <uuid>` allows self-assigned session
ids, MCP server support.

**Decision.** Supersede spec 0006 D9: `gemini-cli` is the second runtime
(spec 0007). Capabilities declared honestly: `hooks: false`,
`transcriptCostParsing: false`, `externalTerminalEscape: false`,
`sessionResume: false` (resume-by-UUID unverified; `--resume` takes
"latest" or an index), `sessionIdCapture: true` via self-assigned
`--session-id`. Codex remains a candidate third runtime; nothing in the
registry design blocks it.

**Consequences.** Agent runs can target either paid plan from the same
kanban. Runtime-capability gating (spec 0006's design) ships unchanged; the
codex.ts implementation file is simply replaced by gemini-cli.ts. Features
relying on hooks or transcripts degrade visibly for gemini runs.

---

## ADR-009 — In-dashboard scheduler narrows ADR-002

**Date:** 2026-06-10

**Context.** ADR-002 ruled out local cron because no always-on host exists
and cross-machine cron management is friction. Since then the dashboard
became a long-running local process (custom server.ts) that is already up
whenever the laptop is. Scheduled work currently only runs via remote
Claude Code scheduled tasks, which cannot file issues on the local kanban
or spawn local PTY runs.

**Decision.** The dashboard process runs its own 60-second scheduler tick
(`lib/scheduler.ts`) that fires `automations/remote/*.md` cron specs by
filing queued issues. No OS cron, no extra daemon: the schedule dies with
the dashboard, which is the ADR-002 spirit. Specs opt in via a `project:`
frontmatter key; fires missed by more than 6 hours are skipped. Remote
scheduled tasks remain the path for work that must run while the laptop is
off.

**Consequences.** One automation spec can now drive both paths. The
scheduler is doubly gated (autonomy kill switch AND a scheduler toggle)
and records state in SQLite (`schedule_state`), so re-runs are exactly
once per scheduled fire.

---

## ADR-010 — Agent handoff via local HTTP API, not stdout parsing

**Date:** 2026-06-10

**Context.** Roadmap Phase 6 designed a `next-task:` stdout protocol for
cross-agent handoffs. The current runtime renders agents in interactive
TUIs inside PTYs; their stdout is ANSI-interleaved screen painting, not a
parseable event stream. The v1 headless pipeline that could parse it is
deprecated.

**Decision.** Handoffs are HTTP: when autonomy is on, every spawned prompt
includes instructions to POST `/api/issues` with `parentIssueId` and
`status: "queued"`. The API is local-only, already validated, and the
chain is capped by `autonomy.maxChainDepth` (children past the cap land in
backlog for a human). The auto-router picks up queued children like any
other issue.

**Consequences.** Handoffs are observable (thread events, parent links in
SQLite) and survive TUI rendering changes. Cost: agents must be able to
make local HTTP calls (claude-code agents can, via Bash with curl or
WebFetch on localhost); a runtime without that ability simply cannot hand
off, which degrades gracefully.

---

## ADR-011 — Vault-backed inbox instead of live MCP queries

**Date:** 2026-06-10

**Context.** The inbox view needs Gmail context (what needs attention).
Two paths: the Next server holds Gmail OAuth and queries an MCP client
live on page load, or the existing agent pipeline (inbox-triage skill on a
schedule) writes digests to `vault/raw/daily/` and the inbox reads the
note index.

**Decision.** Vault-backed. The inbox lists recent `vault/raw/**` notes
(via the spec 0010 index), failed runs from the last 7 days, and issues in
review. The dashboard process never holds Gmail credentials; agents do,
inside worktrees, via MCP templates injected per-run.

**Consequences.** Inbox freshness equals triage cadence (scheduler-driven),
not page-load time. Acceptable for a personal dashboard, and it keeps one
credential boundary: connectors authenticate agents, not the web server.
Reversal: if near-real-time mail becomes necessary, add a read-only MCP
client in the server behind its own ADR.

---

## ADR-012 — One-shot orchestrator draft + deterministic create pipeline

**Date:** 2026-06-10

**Context.** The `/new` tab (spec 0012) turns a prompt into a repo, a
vault project, an agent crew, and kickoff issues. Two designs considered:
spawn an interactive orchestrator agent in a PTY that performs the steps
itself, or make one headless `claude -p` call for the plan and execute
everything else in plain TypeScript. Headless subscription calls draw
from the monthly Agent SDK credit pool; PTY agents emit ANSI screen
painting, not parseable events (the ADR-010 lesson).

**Decision.** Exactly one headless call (the orchestrator draft) returns
project meta + 2-4 agent profiles + 2-5 seed issues as JSON; the
pipeline (`lib/createProject/pipeline.ts`) is deterministic: preflight
before the credit is spent, `gh repo create --source . --push` for the
remote, reuse of the existing project/agent/issue mutation utilities. No
rollback: failures leave completed artifacts and report them. Existing
agent slugs are reused, never duplicated; colliding project slugs get a
numeric suffix. gh failure degrades to local-only with a warning rather
than failing the job.

**Consequences.** Cost is fixed at one credit per create; every step is
testable with injected exec/draft fakes (34 tests); progress is
observable over the existing SSE bus. The draft's quality bounds the
crew's quality — the agent editor remains the correction path. Companion
cleanup in the same build: `dashboard-v1/` (deprecated first build) was
deleted from the working tree; it remains in git history.
