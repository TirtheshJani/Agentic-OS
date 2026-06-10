# Spec 0009: Autonomous Orchestration (Router, Handoff, Scheduler, Kill Switch)

> **Status:** Shipped with the command-center build (June 2026). Implements
> the operative subset of roadmap Phase 6 (multi-agent teams) on the current
> issues/runs dashboard. See ADR-009 and ADR-010.

## Goal

An issue dropped into Queued routes itself to an agent and runs without
clicks. Agents can hand follow-up work to other agents. Cron automations
file their own issues. One visible switch turns all of it off.

## Components

### startRunForIssue (`lib/startRun.ts`)

The run pipeline (resolve, capacity check, worktree, spawn, register,
status flip, thread events) extracted from `POST /api/runs`, so the
auto-router and scheduler start runs in-process. The route is now a thin
wrapper mapping `StartRunError.status` and `ConcurrencyCapError` to HTTP.

Also moves run-exit persistence to spawn time: `finalizeRunExit(runId,
exitCode, signal)` is idempotent (guarded by `ended_at`) and attached to
`pty.onExit` the moment a run spawns. Previously the exit handler only
attached when a browser connected a terminal WebSocket, so an unattended
run never transitioned its issue. server.ts now delegates to the same
function.

### Event bus fix (`lib/stream.ts`)

The listener set moved onto `globalThis` (same dual-module-graph issue and
fix as `liveRuns.ts`): publishes from the tsx server graph now reach SSE
subscribers and the auto-router in the App Router graph.

### Router (`lib/orchestrator/router.ts`)

Deterministic scoring per ADR-007: description-keyword matches weigh 3,
skill-name matches weigh 1, candidates filtered by project capability
eligibility, lead agents (`*-lead` slugs) excluded as targets, ties break
alphabetically. Returns `{ assigneeSlug | null, reason }`; the reason is
written to the issue thread. `settings.autonomy.llmRouting` reserves an
optional one-call headless fallback; it ships disabled and unimplemented.

### Auto-router (`lib/orchestrator/autoRoute.ts`)

Subscribes to the in-process bus; any issue that is `queued` while
autonomy is on gets routed (when unassigned or assigned to a lead) and
started. `ConcurrencyCapError` leaves it queued; a 60s sweep retries.
Spawn failures mark the issue `failed` so the loop cannot spin. An
in-flight set dedupes the event and sweep paths. Singleton via
`Symbol.for("agentic-os.autoRouter")`.

### Handoff protocol (ADR-010)

When autonomy is on, every spawned prompt gains a suffix telling the agent
to `POST /api/issues` with `{ projectSlug, title, body, parentIssueId,
status: "queued" }`. The issues route validates the parent, computes chain
depth (`issues.parent_issue_id`, migration v3), and forces children past
`autonomy.maxChainDepth` (default 3) into `backlog` with a thread note.
PTY stdout parsing was rejected: ANSI-interleaved TUI output is not
reliably parseable; the local HTTP API is already audit-trailed.

### Scheduler (`lib/scheduler.ts`)

60s tick (gated on `autonomy.enabled` AND `autonomy.schedulerEnabled`)
over `automations/remote/*.md`. New optional frontmatter keys: `project:`
(required to fire; names the vault project whose board gets the issue) and
`agent:` (pre-assigns; otherwise the router picks). A due spec files a
queued issue titled `[auto] <skill> (<date>)` labeled `automation`; the
auto-router takes it from there. `schedule_state` records the scheduled
fire time per file; fires older than 6 hours (laptop asleep) are skipped,
not replayed. The validator (`npm run validate:automations`, ported from
v1 along with `validate:skills`) checks the new keys resolve.

### Kill switch

`settings.autonomy.enabled` (default false). Settings page section plus an
always-visible AUTONOMY ON/OFF pill in the nav sidebar. Off means: router
no-ops, scheduler no-ops, handoff suffix omitted; handoff-created issues
still get filed but nothing auto-runs them.

### Boot

`ensureServerBooted()` starts both singletons. Because that boot is lazy
(first request), server.ts fires a warm-up request to `/api/runtimes` one
second after listen, so autonomy works headlessly with no browser open.

## Schema (migration v3, applied on boot)

- `ALTER TABLE issues ADD COLUMN parent_issue_id INTEGER`
- `CREATE TABLE schedule_state (file TEXT PRIMARY KEY, last_run_at INTEGER
  NOT NULL, last_status TEXT, last_issue_id INTEGER)`

## Acceptance

- Autonomy ON: dragging an unassigned issue to Queued produces a routing
  thread event and a running PTY within seconds, no clicks.
- A child issue POSTed with `parentIssueId` auto-runs; at depth >=
  maxChainDepth it lands in backlog with a depth-capped note.
- A `*/2 * * * *` test automation with `project:` files and runs an issue
  within 2 minutes.
- Kill switch OFF stops routing, scheduling, and handoff suffixes.
- A run with no terminal attached still flips its issue on exit.
