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

> **Note (2026-06-10):** Phases 6 through 9 below were written against the
> v1 dashboard (`dashboard-v1/`, headless `claude -p`, `tasks` table,
> `lib/design/` mock shell). That architecture is deprecated. Their goals
> shipped, re-derived for the current PTY/issues dashboard, as Phase 10
> (specs 0007-0011). The sections are kept verbatim for historical context;
> do not implement from them.

## Phase 6 — Multi-agent teams (superseded by Phase 10 / spec 0009)

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

## Phase 7 — Projects, load-bearing (superseded by Phase 10)

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

## Phase 8 — Issues board (superseded by Phase 10; GitHub sync still open)

Tasks, agents, and projects all exist. What's missing is the GitHub-issues
ergonomic: a titled ticket filed against a repo, assigned to an agent, lived
on a board, optionally imported from real GitHub. Phase 6 built tasks as a
streaming workbench primitive; phase 7 scoped them to projects; phase 8 turns
the same row into a board card so work can be filed and tracked instead of
typed-and-fired.

Each step ships independently. Earlier steps unlock later ones; do not skip
order.

### 8.1 Tasks-as-issues schema

`tasks` today is enough to run a job but not to file one: there is no title
distinct from the prompt, no repo binding, no priority or labels, and no
linkage to a real GitHub issue if one was imported. The board needs all five.

- Migration (additive, all nullable): `ALTER TABLE tasks ADD COLUMN title TEXT`,
  `repo TEXT`, `priority TEXT`, `labels TEXT` (JSON array of strings),
  `github_url TEXT`, `github_number INTEGER`. `project_slug` already lands
  via 7.3.
- `createTask` accepts the new fields; absent `title` falls back to the first
  60 chars of `prompt` for display.
- Indexes: `idx_tasks_project_status (project_slug, status)` for the board
  query; `idx_tasks_github (repo, github_number)` for idempotent import.
- `priority` is a free-text enum (`low | med | high | urgent`) validated at
  the API edge, not in SQL.

**Exit criteria:** migration applies on a fresh DB and an existing DB with
rows; existing rows stay valid (NULL title renders from prompt); a task can
be inserted with all new fields populated; board query plan uses the new
index.

### 8.2 Issue create form and detail page

Today a task is born by typing into the workbench prompt. The board needs a
dedicated entry surface so issues can be filed without immediately running
them, and a detail page that shows the ticket alongside its runs.

- `app/issues/new/page.tsx`: title, body (markdown textarea), project picker
  (loads `vault/projects/*/PROJECT.md`), repo (auto-fills from the selected
  project's `repo-url`; editable), agent picker (loads `agents/**/*.md`,
  filtered by project capabilities like the skill rail in 7.2), priority,
  labels (comma chips). Submit creates the task with `status='backlog'`.
- `app/issues/[id]/page.tsx`: replaces the task detail page for tasks that
  have a `title`; renders title, body, agent chip, repo chip, label chips,
  priority badge, status pill, and the existing run history + thread
  components. Status edits via dropdown (`backlog | queued | running |
  review | done | failed`).
- New status `backlog` added to `TaskStatus` (filed-but-not-yet-queued);
  transitioning to `queued` is what hands the task to the existing lead
  routing / runner.

**Exit criteria:** filing an issue with `agent=@arxiv-watcher`,
`project=arxiv-trends` lands a `tasks` row with `status='backlog'`,
populated `title`, `repo`, `agent`. Detail page renders. Flipping to
`queued` triggers the existing claim/start path and a run materializes.

### 8.3 Kanban board

The list view (`/tasks`) shows everything chronologically. The board view
shows a single project's tasks grouped by status, with cards that summarize
the ticket the way GitHub Projects does.

- `app/projects/[slug]/board/page.tsx`: five columns (Backlog | Queued |
  Running | Review | Done). Failed tasks render in a collapsed strip below.
- Card content: title (or prompt prefix), agent avatar (initials chip), repo
  badge, priority badge, label chips, run status if any.
- Status moves via per-card dropdown initially; HTML5 drag-and-drop is a
  follow-up if the dropdown feels heavy.
- Board query: `SELECT * FROM tasks WHERE project_slug = ? ORDER BY priority
  DESC, created_at DESC` — single query, grouped client-side.
- Home page right rail gets an `OpenIssuesCard` showing count per project
  and the top 3 by priority across all projects.

**Exit criteria:** `/projects/fhir-rag-paper/board` renders five columns
populated from `tasks` rows scoped to that project; status dropdown moves a
card and persists; home card reflects open counts within one re-render.

### 8.4 Interactive Claude CLI launcher

Today every run goes through `lib/claude-headless.ts` and `claude -p`. Some
issues are babysit-worthy and want the full REPL: tool approval prompts,
follow-up questions, the works. The dashboard should be able to launch them
without losing the audit trail.

- `agents/*.md` gains optional `default-repo` frontmatter; agents-loader
  surfaces it. Validator (agents validator already exists) checks the path
  exists or warns.
- `lib/claude-launcher.ts` exposes `launch({ mode, cwd, prompt, agent })`
  with `mode: 'headless' | 'terminal'`. Headless is the current
  `claude-headless.ts` path. Terminal spawns `wt.exe -d <cwd> claude
  "<prompt>"` on Windows and a Terminal.app analog on macOS (single
  `process.platform` branch).
- Issue detail page exposes "Run headless" (existing SSE stream) and
  "Open in terminal" buttons. Terminal mode inserts a `runs` row with
  `status='running'`, `source='terminal'`, `cwd`, and waits for the global
  SessionStart hook to attach a real `session_id`.
- The SessionStart/Stop hook (already present per `runs.session_id`) closes
  out the row when the external session ends; if the user never opens the
  terminal, the row stays `running` until a 24h GC pass cancels it.

**Exit criteria:** clicking "Open in terminal" on an issue whose agent has
`default-repo: <abs path>` opens Windows Terminal in that directory with
`claude` started and the issue body as the opening prompt; a `runs` row
exists with `source='terminal'`; closing the session updates `ended_at`
and `status` via the existing hook.

### 8.5 GitHub sync

Several projects already have a `repo-url` pointing at a GitHub repo. The
real issues for those repos should be importable so the board reflects work
that exists elsewhere, with an opt-in write-back so closing an issue locally
can mirror back without forcing it.

- `lib/github-sync.ts`: `importIssues(repo)` shells out to `gh issue list
  --repo <r> --state all --json number,title,body,labels,state,url,assignees,createdAt`
  and upserts into `tasks` keyed on `(repo, github_number)`. Existing local
  rows keep their `agent`, `project_slug`, and `status`; only `title`,
  `body`, `labels`, and `github_url` get refreshed.
- Board view per project gets an "Import from GitHub" button (visible when
  PROJECT.md has a `repo-url`). Reports a count of imported / updated /
  skipped rows.
- Optional write-back, gated by a per-project `PROJECT.md.github-sync:
  read-only | write-back` field (default `read-only`): on status flip to
  `done`, call `gh issue close <n>`; on a thread comment, call `gh issue
  comment <n>`. Write-back failures log to the thread, not silently swallowed.
- `gh` auth is the user's existing CLI auth; no token storage in the
  dashboard.

**Exit criteria:** clicking "Import from GitHub" on a project with a valid
`repo-url` populates the board with that repo's open issues; re-importing
is idempotent (same row updates, no duplicates); with `github-sync:
write-back`, moving a card to Done closes the underlying GitHub issue and
the action is logged to the task thread.

### Phase 8 exit gate

Filing an issue at `/issues/new` with `project=arxiv-trends`,
`agent=@arxiv-watcher`, `priority=high` lands it in the Backlog column of
`/projects/arxiv-trends/board`. Moving the card to Queued triggers the
existing lead/runner chain and a run completes against the issue. Importing
the upstream GitHub repo populates the board with real tickets, and one of
them can be opened in an interactive `claude` terminal session with the
issue body as the opening prompt and the run logged back to the dashboard.

### Out of scope (deliberately)

- Multi-assignee. A task has one `assignee`; multi-agent work goes through
  handoffs (phase 6.5), not co-ownership.
- Milestones, epics, dependencies between issues. `parent_task_id` already
  models chains; anything richer is project-management theatre at this scale.
- Real-time GitHub webhook sync. Pull on demand only; push only when the
  user moves a card. No daemon.
- Issue templates. `PROJECT.md` already documents the working tree; if a
  project needs a stencil for issue bodies, it lives in the project's vault
  folder, not as a dashboard primitive.
- Non-GitHub issue trackers (Linear, Jira). GitHub-only until a second
  tracker becomes load-bearing for an actual project.

## Phase 9 — Design shell wire-up (superseded by Phase 10 / spec-less shell)

A design handoff from claude.ai/design replaced the 3-column workbench with a
sidebar-nav app shell: eight views (dashboard, issues, inbox, my-issues,
agents, skills, runtimes, settings), a global issue slide-over, a TweaksPanel
for runtime layout knobs, and a rebuilt token system (Oswald + Montserrat +
Playfair + JetBrains Mono, dept palette, density vars). The shell lives at
`dashboard/components/design/` and `dashboard/app/page.tsx` already renders
`<AppShell />`. Everything currently reads from a single mock file at
`dashboard/lib/design/data.ts`. Phase 9 replaces the mocks with the real
data the dashboard has carried since phases 6–8 — runs, tasks, agents,
skills, projects, vault changes — view by view, lowest-risk first.

The principle is incremental: each view's components keep their visual
contract; only the imports change. Mock consts get removed when the last
consumer migrates. Types stay (they are the data contract); only the
hardcoded arrays shrink.

Each step ships independently. Earlier steps unlock later ones; do not skip
order.

### 9.1 Server-side data layer

`lib/design/data.ts` mixes types with mock arrays. Splitting the types out
and adding a sibling loader module gives every downstream view a single
import surface, without forcing the views to learn the underlying DB or
loader plumbing.

- `lib/design/types.ts` (new): move every `type` and `Department`-style
  const out of `data.ts`. Pure type/enum module, no fs / db imports, safe
  to import from server or client.
- `lib/design/loaders.ts` (new, `"server-only"`): one async loader per
  view's data block. Initial set:
  `loadDashboard()` (heroMetrics, runningAgents, recentRuns, vaultRecents,
  openIssueCounts), `loadIssues({ project? })`, `loadIssue(id)`,
  `loadAgents()`, `loadSkills()`, `loadProjects()`, `loadInbox()`. Each
  returns the shape currently exported as a mock const, with one obvious
  difference: dates become ISO strings, not "2h ago" — formatting lives in
  the view.
- Loaders compose existing modules: `db.ts` (runs, tasks, vault_changes),
  `agents-loader.ts`, `skills-loader.ts`, `projects-loader.ts`. No new
  schema, no new tables. Department mapping reuses the `agents/*` folder
  layout (1 dept = 1 folder under `agents/`).
- `data.ts` keeps its mock consts but re-exports the types from
  `types.ts` so existing imports keep resolving; consts get an
  `@deprecated` JSDoc tag for the validator/grep to find.

**Exit criteria:** `lib/design/types.ts` and `lib/design/loaders.ts` both
compile under `npm run build`. Calling each loader from a server component
in isolation returns rows from the live SQLite db. `data.ts` still
imports cleanly so every view continues to render. No view migrated yet.

### 9.2 Dashboard view

`DashboardScreen` is the highest-traffic view and the easiest one to wire
(read-only, no mutations). It surfaces hero KPIs, the Delegate composer,
recent runs, live-agent rail, vault recents, and a project list — every
piece has a direct DB equivalent.

- Refactor `dashboard-screen.tsx`: the outer component becomes a server
  component that calls `loadDashboard()` and passes the shape to a small
  client child for the parts that need state (composer textarea, route
  chip, navigation onClick). The two `useState` hooks (`prompt`,
  `routedTo`) live in the client sub-tree only.
- The Delegate composer's submit handler posts to `/api/run` (free-form)
  or `/api/tasks` (when a non-`auto` route chip is selected), reusing the
  existing endpoints from phase 6.
- Hero counters compute server-side from `recentRuns(limit=200)`,
  `getDb().prepare("SELECT status, COUNT(*) ... FROM tasks ...").all()`,
  and an `analytics.ts` helper for 24-hour token/$ totals (already exists).
- "Live agents" rail (top-right of the dashboard panel) shows tasks where
  `status='running'`, joined with `runs` for cost-so-far. New helper:
  `runningTasksWithRun()` in `tasks.ts`.
- Vault recents read `recentVaultChanges(8)`; format relative-time in the
  client.
- `dashboard-screen.tsx` drops every import from `@/lib/design/data`
  except the types (which now come from `@/lib/design/types`).

**Exit criteria:** `/` renders the dashboard with real numbers — running
agent count matches `SELECT count(*) FROM tasks WHERE status='running'`,
recent runs match the 8 most recent rows in `runs`, vault recents match
`vault_changes` ordered by `ts DESC`. Submitting the composer enqueues a
real task or run; no mock IDs leak into the network tab.

### 9.3 Issues board view

`BoardScreen` is the next-highest-leverage view because it ties together
tasks (rows), agents (assignee chip), and projects (filter). Phase 8
already built the `/projects/[slug]/board` page on top of the old UI; this
step replaces that page's renderer with the new design shell.

- `app/projects/[slug]/board/page.tsx` swaps its current render for the
  new `BoardScreen` (already in `components/design/`), with the project
  slug passed in as a prop so `loadIssues({ project })` scopes correctly.
- The global Issues nav target (no project selected) calls
  `loadIssues({ project: null })` and shows the whole board.
- `board-screen.tsx` becomes a server component for the column data; the
  per-card status-move dropdown stays client-side and PATCHes the
  existing `/api/tasks/[id]` endpoint.
- Card chips (agent, repo, priority, labels) resolve from the same
  loader; no separate trips. `parseLabels` shared helper from phase 8.x
  stays the parser.
- The board's "Live agent strip" (when `tweaks.showLiveStrip` is on) is
  the same `runningTasksWithRun()` query from 9.2 — extract to a shared
  loader call.

**Exit criteria:** `/projects/fhir-rag-paper/board` renders five columns
populated from the live `tasks` table, scoped by `project_slug`. Status
move via dropdown persists. Cards open the issue slide-over (still on
mocks until 9.4). Global Issues view (no project) shows everything.

### 9.4 Issue slide-over

`IssueDetail` is the only mutation-heavy surface in the shell: status
edits, label edits, runs list, thread comments, launch buttons. It also
needs to coexist with the existing `/issues/[id]` page from phase 8.2 —
the slide-over is a peek; the page is the deep link.

- `issue-detail.tsx` accepts `issueId: string | number`, fetches via a
  new `/api/tasks/[id]/detail` route that returns the task row, parsed
  labels, recent runs joined by `task_id`, and the thread file body
  (`vault/threads/<id>.md`).
- Status dropdown, priority dropdown, and label editor PATCH
  `/api/tasks/[id]` (existing). Failed PATCH surfaces an inline toast,
  not a console.error.
- Thread comment box appends to `vault/threads/<id>.md` via the existing
  task-thread API (already shipped in phase 6.6). Reuse the React
  component if its API matches; otherwise port the append logic.
- "Run headless" and "Open in terminal" buttons reuse the existing
  `IssueLaunchButtons` component (phase 8.4) so the launcher path is not
  duplicated.

**Exit criteria:** opening any board card surfaces real labels, real
runs, real thread entries. Changing status from the slide-over reflects
in the board behind it within one re-render. The standalone
`/issues/[id]` page and the slide-over query the same endpoint and stay
in sync after a mutation.

### 9.5 Agents, Skills, Runtimes

These three are pure-read directory listings — the lowest-risk views.
They each map 1:1 to an existing loader module.

- `AgentsScreen` consumes `loadAgents()` -> `agents-loader.ts`. Cards
  group by `dept` (which is the agent's folder), badge by `role`, link
  to a per-agent detail page (out of scope; status chip only for now).
- `SkillsScreen` consumes `loadSkills()` -> `skills-loader.ts`. Filter
  chips by domain/family; status pill from `metadata.status`; cadence
  from any matching `automations/remote/*.md` schedule (reuse
  `schedules.ts`).
- `RuntimesScreen` is the same data as Skills, filtered to
  `metadata.mode === "remote"` and grouped by `mcp-server`. No new
  loader; just a different render of the same array. Confirms that one
  loader can drive two views.

**Exit criteria:** Agents view lists every `agents/**/*.md` profile,
grouped by folder, with the validator's authored/stub status visible.
Skills view lists every `skills/**/SKILL.md` with the same fields the
old `SkillsRail` showed. Runtimes view is the remote subset of Skills.

### 9.6 Inbox, My Issues, Settings

The last three views need a definition before they can wire. Inbox is
new; My Issues is a saved filter; Settings is read-only config.

- `InboxScreen`: a merged feed of (a) vault writes in the last 7 days,
  (b) failed runs in the last 7 days, (c) tasks assigned to the user
  with `status='backlog'`. Sorted by time desc. One unread badge per
  item (state lives in localStorage — no new column needed; the badge
  is a viewing-convenience, not durable).
- `MyIssuesScreen`: `loadIssues({ assignee: 'user' })` — the same loader
  as 9.3 with one extra filter. No new code beyond the option.
- `SettingsScreen`: pure-read summary of the on-disk config —
  `dashboard/package.json` version, validator counts (skills/agents/
  projects), schedule count, last vault-recall index timestamp (read
  from `.agentic-os/state.db` via the `vault_chunks_meta` table once
  vault-recall is committed). No writes; settings stay in files.

**Exit criteria:** Inbox shows the live merged feed; My Issues shows
only tasks where `assignee='user'`; Settings shows live counts. No mock
data referenced from any of the three views.

### 9.7 Delete mock data

When no view imports a `*` const from `@/lib/design/data`, the file
contains only deprecated re-exports — time to remove it.

- Grep confirms zero non-type imports from `@/lib/design/data`.
- Delete the file. Types are imported from `@/lib/design/types`
  exclusively.
- `npm run build` and `npm run lint` both pass.

**Exit criteria:** `lib/design/data.ts` is gone. No regressions.

### Phase 9 exit gate

The live dashboard at `/` shows real numbers: running task count, recent
runs, vault recents, project list. `/projects/<slug>/board` renders real
tasks scoped to the project. Clicking a card opens the slide-over with
real labels, runs, and thread. Agents / Skills / Runtimes / Inbox / My
Issues / Settings all render from real loaders. No file under
`dashboard/` imports a mock array from `@/lib/design/data`. Build, lint,
and validators all exit 0.

### Out of scope (deliberately)

- New views beyond the eight the design ships with. Anything new is
  Phase 10+.
- Per-agent detail page, per-skill detail page. Linkable but stub
  routes; not in this phase.
- Realtime websockets for the dashboard. Server components + manual
  refresh + SSE on the issue slide-over is enough at this scale.
- Storybook / fixtures. Tests use the live db with a temp file; no
  separate mock library to maintain.
- Theming variants. Single dark cosmic theme; tokens are tunable but no
  light mode.

## Phase 10 — Command center (shipped 2026-06-10)

The "executable Claude dashboard" build: specs 0007 through 0011, commits
f1ce55e..84a2ec4. Re-derived the goals of phases 6-9 on the current
dashboard (PTY runtimes, issues/runs SQLite, worktree isolation).

What shipped:

- **Second runtime: Gemini CLI** (spec 0007, ADR-008). Runtime capability
  flags on the contract, /api/runtimes, RuntimeBadge, per-run override.
  Claude Max and Google AI Pro drive runs side by side.
- **App shell** with global cross-project kanban (/issues, quick-assign on
  cards), plus runtimes/skills/settings views.
- **Agent creator** (spec 0008): CRUD over agents/<slug>.md with
  validation and a one-call Draft-with-AI assist.
- **Packaging**: PowerShell launcher, Start Menu shortcut, installable
  PWA (bin/launch-dashboard.ps1, bin/install-shortcut.ps1).
- **Autonomy** (spec 0009, ADR-009/010): deterministic auto-routing of
  queued issues, HTTP handoff chains capped by depth, in-dashboard cron
  scheduler for automations/remote, spawn-time run-exit persistence,
  global kill switch with nav pill. Validators ported to the live package.
- **Knowledge layer** (spec 0010): SQLite index of vault notes, wikilinks,
  tags; FTS5 search; interactive sigma.js graph at /graph with Obsidian
  deep links.
- **Connections hub + inbox** (spec 0011, ADR-011): live status for
  Claude/Gemini/GitHub, MCP templates in .agentic-os/mcp/ injected into
  run worktrees per project frontmatter, vault-backed inbox.

Deferred, in rough priority order:

- GitHub issue sync (phase 8.5 design still applies; gh CLI is ready).
- Cost/usage analytics (transcriptCostParsing capability flagged false on
  both runtimes until a parser exists).
- Gemini session resume + per-workspace Gemini MCP config (open questions
  in spec 0007/0011).
- LLM routing fallback (flag exists, default off, unimplemented).
- LinkedIn connector (deferred by decision; slot documented in spec 0011).
- Events tab + synthetic lifecycle events from spec 0006.

## Phase 11: Reliability and quality wave (planned 2026-06-12)

Six specs (0024-0029) and three ADRs (020-022), grilled from the current run
lifecycle plus the Factory missions talk and Matt Pocock's Claude Code material.
Ordered reliability first. Status as of 2026-06-12: 0024 core shipped (with a
divergence from ADR-020), 0025 partially shipped, 0026 through 0029 still drafts.

- **Run durability** (spec 0024, ADR-020): core boot reconciliation shipped
  (commit 538c359), so the router can no longer deadlock on phantom capacity.
  Diverges from ADR-020: orphans are marked `failed` and sent to `failed` rather
  than a distinct `interrupted` status sent to `review`. Aligning the code to the
  ADR (or amending the ADR) is an open follow-up, see the spec's sync note.
- **Repo hygiene and CI** (spec 0025): partially shipped. The 6.2M nested
  `docs/Claude-Control-Center-main` is extracted and an ESLint config landed; the
  `.github/workflows` CI job that runs the 51 vitest tests, the validators, lint,
  and build is still pending.
- **Reflection loop** (spec 0026, ADR-021): a sub-threshold judge grade files one
  revision behind the autoGrade plus autonomy double gate, then escalates to
  `review`. Amended to revise against named failed assertions when a contract
  exists.
- **Command center HUD** (spec 0027): a fixed dense overview landing assembled
  from existing components (RunningSessionsStrip, kanban cards, the SSE stream,
  capacity and grade readouts), no new layout dependency.
- **Agent authoring standard** (spec 0028): `standards/agent-authoring.md`, a
  `validate-agents` script, and enrichment of thin `description` fields to keep
  ADR-007 routing robust.
- **Validation contracts and structured handoffs** (spec 0029, ADR-022): an
  optional `## Acceptance contract` section in the issue body, per-assertion judge
  grading with fallback to the generic rubric, and a worktree `HANDOFF.md` parsed
  on finalize and fed to the judge.

**Phase 11 exit gate:** the dashboard survives a restart mid-run without wedging
the router (0024); CI runs green on push (0025); a low-graded autonomous run
self-revises once then escalates (0026); the landing shows a live single-screen
overview (0027); `validate-agents` passes and routing stays robust on
skill-free prompts (0028); a graded run with a contract reports per-assertion
pass or fail and writes a parsed handoff (0029).

### Deferred from the same session (candidate next specs)

- Domain glossary (ubiquitous language from DDD) plus "why in every task," folded
  into spec 0028's agent-context injection. The cheapest precision win.
- Behavioral end-to-end validator that spawns and drives the app via the vendored
  Playwright skill, checking the spec-0029 contract. The user-testing half of
  Factory's scrutiny-versus-user-testing split.
- Mission or epic layer above issues, with milestones and a shared contract. The
  "orders of magnitude harder tasks" unlock.
- Role-based model assignment (planning, implementation, validation), with the
  validator on a different provider to dodge shared-training bias. The dual-runtime
  registry already could express this.

### Open strategic forks (decide consciously, not yet specs)

- Serial versus parallel execution. Factory runs features serially with read-only
  parallelization because naive parallelism made agents conflict; the current cap
  allows concurrent runs. Candidate default: parallel across independent issues,
  serial within an interdependent set.
- Prompt-driven orchestration versus deterministic pipelines (ADR-012). Factory
  keeps orchestration in prompts and skills so it compounds with each model
  release; the current pipelines are deterministic for cost and testability.

### Sync note (2026-06-12)

Independent of this wave, a third runtime, Antigravity (`agy`), was registered in
`server-init.ts` alongside Claude Code and Gemini CLI (commit f3110fa). It
supersedes ADR-008's "Codex as candidate third runtime" but has no ADR of its
own yet. It also widens the deferred role-based model-assignment idea from two
seats to three (planning, implementation, validation can now each target a
different runtime).

## Phase 12: Compounding quality wave (planned 2026-06-13)

The four candidates parked at the end of the Phase 11 grilling session, now
promoted to specs 0031 through 0034 and ADRs 024 through 027. Ordered cheapest
leverage first. Phase 11 (specs 0024 through 0030) shipped in full, and the same
burst cleared the Phase 10 deferred backlog (GitHub issue sync, cost analytics,
Gemini session resume, LLM-routing fallback, the events tab), so this wave starts
from a near-empty board.

- **Domain glossary** (spec 0031, ADR-024): a `product/glossary.md` source of
  truth injected into agent context at spawn, plus an optional `## Why` line on
  issues, plus glossary aliases credited in ADR-007 routing. The cheapest
  precision win; folds into the spec-0028 agent-context injection. Author first.
- **Role-based model assignment** (spec 0033, ADR-026): an optional, default-off
  `roleAssignment` map sending plan, implementation, and validation to different
  runtimes, so the judge can run on a different model from the implementer and
  dodge shared-training bias. Self-contained; extends ADR-023's third seat.
- **Behavioral end-to-end validator** (spec 0032, ADR-025): a default-off harness
  that drives the running app via the vendored Playwright skill to check the
  `(e2e)`-marked assertions of the spec-0029 contract, feeding per-assertion pass
  or fail to the judge. The user-testing half of the scrutiny-versus-user-testing
  split; spec 0029 was built to feed it.
- **Mission/epic layer** (spec 0034, ADR-027): a first-class `epics` table above
  issues with a shared contract, a rollup grade, and dependency-ordered routing
  (parallel across independent children, serial within a dependent set). The
  orders-of-magnitude-harder-tasks unlock and the largest spec; it settles the
  serial-versus-parallel fork. Schedule last.

**Phase 12 exit gate:** a spawned run carries the glossary block and a task `why`
(0031); the judge can be pinned to a validation runtime distinct from the
implementer (0033); a graded run with an `(e2e)` assertion is verified against the
running app, not just the transcript (0032); a multi-issue epic shows a rollup
status and the router honors its dependency order (0034).

The three open issues at the start of this wave (#37 youtube-search, #39
comment-digest, #40 external DB) are left as-is: the first two are blocked on
external access and the third conflicts with ADR-001 (SQLite as system of record).
