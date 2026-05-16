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

## Phase 6 — Multi-agent teams

Borrow the agents-as-teammates model from
[multica](https://github.com/TirtheshJani/multicaproject) (squads under a
leader agent, task lifecycle, comments) and graft it onto the existing
branch-as-department structure. Single operator — non-goal of "multi-user
team deployments" still holds. The "team" is internal: TJ assigns to a
department or a named agent, the lead routes, agents hand off via comments
and follow-up tasks. No Postgres, no Go daemon — stays on SQLite + Next.js.

Each step ships independently. Earlier steps unlock later ones; do not skip
order.

### 6.1 Agent profiles

- `agents/<department>/<name>.md` with frontmatter: `name`, `model`,
  `department`, `role` (`lead` | `member`), `allowed-skills`, `allowed-tools`,
  `system-prompt` (path to a `.md` seed).
- Departments map 1:1 to existing branches (`research`, `coding`, `content`,
  `business`, `productivity`, `_meta`).
- One `lead` agent per department, 0+ `member` agents.
- `lib/agents-loader.ts` mirrors `skills-loader.ts`; validator added to
  `npm run validate:agents` (frontmatter shape, lead-per-department).

**Exit criteria:** at least one agent profile per active department, validator
exits 0, dashboard "Team" rail lists them grouped by department.

### 6.2 Task lifecycle in SQLite

- New `tasks` table: `id`, `prompt`, `assignee` (agent name or `user`),
  `department`, `parent_task_id` (nullable), `status`
  (`queued` | `claimed` | `running` | `done` | `failed`), `created_at`,
  `started_at`, `finished_at`, `run_id` (FK into `runs`).
- API: `POST /api/tasks` (enqueue), `POST /api/tasks/:id/claim`,
  `POST /api/tasks/:id/start`, `POST /api/tasks/:id/finish`.
- Existing `runs` table gets a nullable `task_id` column so a one-off prompt
  still works without a task.

**Exit criteria:** task can be created via API and round-trip through all
states; `runs` row links back to its task; migrations apply cleanly on a fresh
DB.

### 6.3 Assignee picker in the workbench

- Prompt panel grows an "Assign to" control: defaults to `user` (current
  behavior, no task row), can target a department (`@research`) or a named
  agent (`@arxiv-watcher`).
- Department target enqueues a task with `assignee=lead:<dept>`; named target
  enqueues `assignee=<agent>` directly.
- Workbench shows a "queue" sub-rail per department with pending/claimed
  counts.

**Exit criteria:** UI can enqueue a task to a department or an agent; queue
counters update without a page reload.

### 6.4 Lead routing skill

- One skill per department: `<dept>/lead`. Reads the department queue, picks
  a teammate based on `allowed-skills` overlap with the task, and reassigns
  the task to that teammate.
- Spawns `claude -p` with the chosen agent's system prompt and skill
  allowlist via `--allowed-tools` and a prepended system message.
- Lead loop runs as a local cron (`automations/local/<dept>-lead.sh`) or on
  demand from the dashboard.

**Exit criteria:** an unassigned task addressed to a department gets claimed
and reassigned by the lead within one tick; assignment is logged to the
task's thread.

### 6.5 Cross-agent handoff

- Streaming protocol gains a `next-task` event: an agent emits a JSON line
  with `{ assignee, prompt, parent_task_id }`; `claude-headless.ts` parses it
  and `POST`s to `/api/tasks` with `parent_task_id` set.
- Skills can opt into handoff with a frontmatter flag
  (`metadata.handoff: true`) so accidental emissions don't fan out.
- Dashboard renders the parent → child chain on the task detail view.

**Exit criteria:** a content/draft skill can hand off to a content/edit skill
end-to-end; chain renders in the dashboard with both run logs accessible.

### 6.6 Task thread (comments)

- Per task: `vault/threads/<task-id>.md` with append-only entries (timestamp,
  author, body). Lead routing decisions, agent self-notes, and human comments
  all land here.
- Dashboard task detail renders the thread; a text box at the bottom appends
  a `user`-authored entry.
- Skills can write to the thread via a `thread.md` convention — no new tool,
  just a known path the orchestrator tails.

**Exit criteria:** thread file exists for every task with at least one entry;
dashboard renders it; manual append from the UI persists.

**Phase 6 exit criteria (gate to call it done):** TJ can type "research the
NIH stance on FHIR-RAG and draft a Substack section" into the prompt panel
with assignee `@research`, watch `research-lead` claim and route the task to
`health-watcher`, watch `health-watcher` produce a digest and hand off to
`anxious-nomad-writer` via `next-task:`, and end with two linked runs plus
a parent-child task thread pair in the vault — without TJ touching the
keyboard between handoffs.

**Status: gate plumbing complete (2026-05-16).** Auto-spawn closes the loop
in /api/run; the handoff gate trusts named-agent runs as of phase 6.8;
`health-watcher` and `anxious-nomad-writer` member agents are in place; lead
routing scores on agent description + skill names. Live e2e demo run is
pending operator execution; chain is structurally ready.

### Out of scope (deliberately)

- Multi-user auth, RBAC, shared workspaces. Mission non-goal stands.
- Postgres / pgvector. SQLite is enough at this scale.
- Multi-CLI runtime (Codex, Copilot, Cursor). Claude Code only; revisit if a
  specific workflow proves Claude is the wrong tool.
- Agent-to-agent direct messaging outside of tasks. Threads are the only
  channel; keeps the audit trail intact.
