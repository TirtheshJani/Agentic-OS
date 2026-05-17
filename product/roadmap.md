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

## Phase 7 — Projects, load-bearing

PROJECT.md, projects-loader, and the rail's PROJECTS section all shipped
during phase 5/6. The work in front of us is making projects do something:
filter skills, scope tasks, drive a detail view, and surface project-local
status. Single operator, single SQLite DB still. No new infrastructure.

Each step ships independently. Earlier steps unlock later ones; do not skip
order.

### 7.1 PROJECT.md validator

The 12 existing PROJECT.md files were hand-authored and the schema is
documented only in `vault/projects/README.md`. There's no validator, so
drift goes unnoticed (one project has `repo-url: ""`, another has an
absolute `path:`, neither is wrong but both are unenforced).

- `dashboard/scripts/validate-projects.mjs` mirroring validate-skills /
  validate-agents: required fields (`name`, `slug`, `description`,
  `status`), kebab-case slug matching folder name, `branch` in an allowed
  set (or warn-only on unknown), `status` in `active | dormant | archived`,
  `path` exists or is flagged with a warning (not a fail — repos can move).
- `npm run validate:projects` in `dashboard/package.json`.
- Audit the 12 existing PROJECT.md files; fix drift in one commit.

**Exit criteria:** validator exits 0 on every PROJECT.md, schema lives in
the script (not just the vault README), CI-ready.

### 7.2 Per-project skill scoping

`PROJECT.md.capabilities` is currently read by the loader but ignored by
the UI. Selecting `fhir-rag-paper` should narrow the skills rail to skills
whose `metadata.domain` matches one of `[healthcare-ai, research, coding]`.

- Workbench filters `Skill[]` by intersecting `skill.branch.family` and/or
  `skill.domain` with the selected project's `capabilities`. Show a
  collapsed "Show all (N hidden)" toggle below the filtered list so the
  full roster is still one click away.
- Add an optional `PROJECT.md.allowed-skills: [..]` for explicit allow-list
  override when capability tags aren't precise enough.
- Validator (7.1) warns if `allowed-skills` references a skill that does
  not exist.

**Exit criteria:** with a project selected, the rail shows only matching
skills by default; "Show all" reveals the rest; deselecting the project
restores the full list. Filter is empty-state safe (a project with
`capabilities: []` shows everything).

### 7.3 Tasks linked to projects

Tasks have `assignee`, `department`, `parent_task_id` but no project
linkage. A task created while `fhir-rag-paper` is selected should record
that, so the project detail page can show its open work.

- Migration: `ALTER TABLE tasks ADD COLUMN project_slug TEXT` (nullable;
  existing rows stay NULL).
- `createTask({ projectSlug })` accepts the field; workbench passes
  `selectedProject` through `POST /api/tasks`.
- Handoff inheritance: child tasks created via `next-task:` inherit the
  parent's `project_slug` unless the handoff payload overrides it.
- Lead routing reads `task.project_slug` and, when present, restricts
  candidate teammates to those whose `allowed-skills` intersect the
  project's `capabilities`.

**Exit criteria:** enqueue a task with a project selected; row has
`project_slug`. Child task inherits it across one handoff. Lead routing
respects project scoping (a content-only project does not route to a
research-only teammate).

### 7.4 Project detail page

The rail can select a project but there's no detail view. The skill detail
analogue is the `tasks/[id]` page; projects need the same.

- `app/projects/[slug]/page.tsx` rendering: PROJECT.md prose, capabilities
  as chips, repo-url link, working-tree path with `pathExists` indicator.
- Three scoped lists: open tasks (`project_slug = ?`), last 10 runs (via
  the runs/tasks join), last 10 vault writes inside `vault/projects/<slug>/`
  or the project's working-tree path.
- A "Run in this project" button that pre-selects the project and focuses
  the workbench prompt.

**Exit criteria:** `/projects/fhir-rag-paper` renders prose + three lists,
all scoped. Clicking a task navigates to the existing task detail page.

### 7.5 Project status surface

When a project is selected on the home page, the right rail should swap
some of its generic cards for project-scoped ones.

- New `ProjectStatusCard` showing: open task count by status, last vault
  write inside the project, last git commit on the project path
  (`git log -1 --format=%cI -- <path>` cached for 60s).
- `RecentRunsCard` filters by `project_slug` when one is selected; falls
  back to all runs otherwise.
- Workbench title shows the selected project name as a chip; clearing the
  project removes the filter.

**Exit criteria:** selecting a project changes the right rail in a single
re-render. No regression when no project is selected.

### Phase 7 exit gate

Selecting `fhir-rag-paper` in the rail filters the skills list to the
project's capabilities; enqueuing a task creates a row with
`project_slug='fhir-rag-paper'`; the auto-spawned chain inherits the
project across handoffs; the `/projects/fhir-rag-paper` page shows that
task in its "open tasks" list and the run in its "recent runs" list. The
validator passes on all 12 PROJECT.md files.

### Out of scope (deliberately)

- Multi-project tasks. A task belongs to one project (or none).
- Cross-project handoffs. A handoff with project X stays in project X
  unless the handoff payload explicitly sets a different `project_slug`.
- Auto-detection of project from prompt content. The selected project
  is the source of truth.
- Project lifecycle automation (status transitions, archival). The
  `status` field is human-edited.
