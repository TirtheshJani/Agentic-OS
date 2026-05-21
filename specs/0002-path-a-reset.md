# Spec 0002: Path A reset

**Status:** proposed.
**Owner:** Tirthesh.
**Date:** 2026-05-20.
**Branch:** `feat/path-a-reset` (to be created).
**Supersedes large portions of:** `plan.md` (Layer 3 and Phases 6 through 9 of `product/roadmap.md`).

## Why

The original idea in `plan.md` was a command center where you pick a project (local folder or GitHub repo), assemble a crew of agents with relevant skills, and run them on the work. Three steps. Through Phases 6 through 9 the dashboard accreted abstractions that drifted from this: department-scoped lead routing, a deterministic-plus-LLM router, team objects, a `next-task` handoff protocol, an inbox, a my-issues view, a global vault search, an analytics page, a session log viewer. Twenty-seven API routes, twenty-two lib modules, ~3,900 lines of design components, nine sidebar entries. None of those entries is "start here, pick a project."

This spec resets the dashboard to the original three-step flow, borrowing the project / issues / agents / runtimes data model from Multica (`multica-ai/multica`) but shaped for a single operator. Execution moves off `claude -p` and off the Claude Agent SDK entirely. All agent work runs in interactive `claude` CLI sessions inside a PTY (and other CLIs later: Codex, Antigravity, Gemini CLI), so usage stays on the Max plan rather than the separately metered Agent SDK budget.

## Goal

A working `dashboard/` that lets one operator:

1. Pick a project (clone from GitHub URL into the configured workspace root, or link an existing folder).
2. Assemble a crew (pick agents from the roster, filtered by the project's capabilities tags).
3. File issues against the project, assign each issue to one crew member, and run it.

A "run" spawns the agent's configured CLI (default `claude`) inside a PTY in the project's working tree (or in a per-issue git worktree for parallel async work). Output streams to an xterm.js panel in the dashboard, with an "open in terminal" escape hatch.

## Scope

In scope:

- New `dashboard/` (Next.js 15, App Router, SQLite, Tailwind, shadcn).
- New `lib/runtime/` layer: PTY spawn, runtime registry, claude-code runtime.
- New schemas for `projects`, `agents`, `issues`, `runs`, `threads`, `hook_events`.
- Migration script from current data shape to new shape (`scripts/migrate-to-0002.ts`).
- Hard cutover: current `dashboard/` becomes `dashboard-v1/`, not deleted, not running.
- Flat `agents/` directory (no department folders).
- Hooks integration via `.claude/settings.json` POSTing to a dashboard endpoint.
- Five UI surfaces: Home, Project, Issue slide-over, Agents, Settings.

Out of scope (deferred or deleted):

- Lead routing of any kind. No router, no leads, no `next-task` chains.
- Team / squad objects. The crew is just a list of agent slugs on a project.
- Pipeline mode (squad mode also out). Roster only: one issue, one assignee.
- Inbox, My Issues, Vault browser, Analytics, Session Log screens.
- Global vault search.
- Multi-tenant or multi-workspace concepts. One operator, one machine.
- Claude Agent SDK use. `@anthropic-ai/claude-code` package is not a dependency.
- `claude -p` invocation. No headless one-shot mode.
- Remote / cloud runtimes. All runtimes are local CLIs on PATH.

## Acceptance criteria

A1. Fresh clone, `npm install` in `dashboard/`, `npm run dev`, browser to `localhost:3000` shows the Home page with the migrated list of projects from `vault/projects/*/PROJECT.md`.

A2. On Home, clicking "New Project, Clone from GitHub URL" prompts for a URL, runs `gh repo clone <url> <workspaceRoot>/<slug>`, generates a `PROJECT.md`, and the project appears on Home.

A3. On Home, clicking "New Project, Link existing folder" accepts a path, creates a `PROJECT.md` whose `path:` points there, and the project appears on Home.

A4. The Project page renders the kanban with five columns (Backlog, Queued, Running, Review, Done) and a crew roster sidebar. "Edit crew" opens a slide-over listing all agents whose `skills:` intersect the project's `capabilities:`.

A5. "New Issue" on the Project page creates an issue, assigned to a crew member, in Backlog. Drag to Queued enables a "Start" button on the Issue slide-over.

A6. Clicking "Start" on a Queued issue: creates a `runs` row, spawns `claude` in a PTY in the issue's worktree (created if absent), writes the issue body to the PTY as the first user turn, moves the issue to Running, and streams output to xterm.js in the Issue slide-over.

A7. Two issues started on the same project run in parallel, each in its own git worktree at `<workspaceRoot>/<slug>/.worktrees/issue-<id>/`. The Home running-sessions strip shows both.

A8. SessionStart and SessionEnd hooks POST to `POST /api/hooks/event`. The endpoint writes a `hook_events` row and updates the run's `pty_session_id` (on start) and `exit_status` (on end).

A9. "Open in terminal" on a Running issue spawns Windows Terminal (Windows) or `osascript -e 'tell app "Terminal" to do script'` (macOS) and attaches the same `claude` session (via `claude --resume <session-id>`).

A10. Settings shows workspace root (editable), concurrency caps (editable), and the runtime registry (read-only on Phase 3, edit toggles in Phase 6) with each runtime's detected version.

A11. The migration script, run once, converts every existing `agents/<dept>/<name>.md` to `agents/<name>.md` with a `skills:` array derived from the old department, sets `runtime: claude-code`, and rewrites references. It updates every `PROJECT.md` with `runtime-default: claude-code` and an empty `crew: []`. It alters the SQLite schema (drops `teams` and `lead_routes` tables if present, renames `tasks` to `issues`, adds `mode` column).

A12. The `lead/tick`, `router`, `teams`, `mcp`, `inbox` API routes do not exist in the new dashboard. The `claude-headless.ts`, `claude-launcher.ts`, `router.ts`, `teams.ts`, `run-execution.ts`, `task-runner.ts`, `run-guards.ts`, `shared-vault.ts`, `analytics.ts` lib modules do not exist in the new dashboard.

A13. The QML healthcare diagnostics project (or whichever is the current most-active research project) advances by one real, useful issue on the new system, end-to-end, before the spec is closed.

## Architecture

### Primitives

Six things. Everything else is a view of these.

**Project.** Stored as `vault/projects/<slug>/PROJECT.md` with YAML frontmatter and a freeform markdown body for human notes.

```yaml
---
name: QML Healthcare Diagnostics
slug: qml-healthcare-diagnostics
path: C:\Users\TJ\code\qml-healthcare-diagnostics    # or absolute POSIX path
repo: https://github.com/TirtheshJani/qml-healthcare-diagnostics
crew: [lit-reviewer, physicist, technical-writer]
runtime-default: claude-code
capabilities: [research, physics, writing, literature-review]
created: 2026-05-20
---

# QML Healthcare Diagnostics

Notes, references, decisions go here. The dashboard does not render this body.
```

The `path:` field is the working tree on disk. The `vault/projects/<slug>/` folder holds metadata only: threads, outputs, project notes.

**Agent.** Stored as `agents/<slug>.md`. No department folders.

```yaml
---
name: Literature Reviewer
slug: lit-reviewer
runtime: claude-code
allowed-tools: [Read, Edit, Bash, WebFetch, WebSearch]
skills: [research, literature-review]
created: 2025-09-12
---

# System Prompt

You are a literature reviewer. Your job is to find relevant prior work, summarize it
faithfully, and produce structured notes in the project's outputs folder. Cite
everything. Prefer primary sources. Surface disagreements between sources rather than
flattening them.
```

The "System Prompt" markdown body is the agent's `--append-system-prompt` payload at spawn time. The `allowed-tools` array becomes `--allowed-tools`. The `skills:` tags are how the project's `capabilities:` filter narrows the crew picker.

**Issue.** Lives in SQLite. No markdown file representation (changed from current setup; threads are still markdown).

```sql
CREATE TABLE issues (
  id              INTEGER PRIMARY KEY,
  project_slug    TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  assignee_slug   TEXT,                             -- agent slug from project's crew
  status          TEXT NOT NULL DEFAULT 'backlog',  -- backlog|queued|running|review|done|failed
  mode            TEXT NOT NULL DEFAULT 'async',    -- sync|async
  priority        INTEGER NOT NULL DEFAULT 0,       -- 0=normal, 1=high, -1=low
  labels          TEXT,                              -- JSON array
  github_url      TEXT,
  github_number   INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX issues_project_idx ON issues(project_slug, status);
```

**Run.** One execution of one issue.

```sql
CREATE TABLE runs (
  id              INTEGER PRIMARY KEY,
  issue_id        INTEGER NOT NULL REFERENCES issues(id),
  agent_slug      TEXT NOT NULL,
  runtime_id      TEXT NOT NULL,                   -- 'claude-code', 'codex', etc.
  worktree_path   TEXT NOT NULL,                   -- absolute path to worktree
  pty_session_id  TEXT,                             -- set when claude SessionStart hook fires
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  exit_status     TEXT,                             -- 'success'|'error'|'killed'|null while running
  transcript_path TEXT                              -- ~/.claude/projects/<id>/<session>.jsonl
);
CREATE INDEX runs_issue_idx ON runs(issue_id, started_at DESC);
```

**Thread.** Append-only comments and events on an issue. Markdown file at `vault/projects/<slug>/threads/<issue-id>.md`. New entries appended by the dashboard with timestamps. Events from hooks (e.g., "SessionStart at 14:23:11, session id abc123") get appended automatically.

**Runtime.** Code, not data. Lives in `dashboard/lib/runtime/`. Each runtime is a TypeScript module that exports `id`, `cli`, `detect()`, and `spawn(opts): PtyProcess`.

### Execution layer

`lib/runtime/spawn.ts` wraps `node-pty`. The function `spawn(runtime, opts)` returns a `PtyHandle`:

```ts
interface PtyHandle {
  sessionId: string;          // dashboard-internal id
  pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onData(cb: (chunk: string) => void): () => void;  // returns unsubscribe
  onExit(cb: (code: number, signal: string | null) => void): () => void;
  kill(signal?: string): void;
}
```

`lib/runtime/registry.ts` holds the list of runtimes and dispatches by id. `detect()` runs at server start and caches: it calls `which claude` (or `where claude` on Windows) and stores the version from `claude --version`.

`lib/runtime/claude-code.ts` is the first runtime. Its `spawn()` builds the argv:

```
claude
  --add-dir <issue-worktree>
  --append-system-prompt <agent.system_prompt>
  --allowed-tools <agent.allowed_tools_csv>
```

The PTY's cwd is the issue's worktree. After spawn, the orchestrator writes the issue's body to the PTY as the opening turn (followed by a newline) so the agent gets the task immediately.

Output flows: PTY stdout / stderr → `onData` → in-memory ring buffer (last N kb per session for late joiners) → WebSocket → browser → xterm.js. Input: browser keystrokes → WebSocket → `write()` → PTY stdin. The WebSocket lives at `/api/runtime/socket` and multiplexes by `sessionId`.

Hooks: `.claude/settings.json` (the user's, or per-project at `<workspaceRoot>/<slug>/.claude/settings.json`) registers hooks that `curl -s -X POST http://localhost:3000/api/hooks/event -d '{...}'`. The event payload includes the Claude session id, project, and event type. The dashboard correlates the Claude session id to the run by matching the recently-spawned PTY in the same worktree.

### Parallelism

Each running async issue gets its own git worktree, scoped to the project:

```
<workspaceRoot>/<slug>/.worktrees/issue-<id>/
```

The branch name is `issue-<id>-<slug-of-title>`. Created with `git worktree add <path> -b <branch>`. Removed with `git worktree remove --force <path>` when the issue moves to Done or Failed.

Non-git projects (PROJECT.md.path is not a git repo): run inline in the working tree. Enforce serial-per-project unless the project has `allow-parallel-edits: true`. Surface a one-time warning in the UI when enabling.

Concurrency caps in `settings.json`:

```json
{
  "concurrency": {
    "perProjectMax": 3,
    "globalMax": 5
  }
}
```

The orchestrator refuses to start a new run when caps are exceeded. The "Start" button on Issue slide-over goes disabled with a tooltip.

Sync issues do not consume cap budget the same way: a sync run still creates a worktree and PTY, but a sync run does not auto-advance state through Queued; the user starts it manually and is expected to babysit. The cap counter still includes sync runs (a running PTY is a running PTY).

### Disk layout

```
agents/
  <slug>.md                                    # flat, no department folders

skills/                                        # untouched
  _meta/                                       # vendored community skills
  <domain>/<area>/<name>/SKILL.md

vault/
  CLAUDE.md
  projects/<slug>/
    PROJECT.md
    threads/<issue-id>.md
    outputs/
  threads/                                     # legacy cross-project threads, read-only
  reference/

<workspaceRoot>/<slug>/                        # actual working tree (configurable)
  .git/
  src/, etc.
  .worktrees/issue-<id>/                       # gitignored
  CLAUDE.md                                    # project-scoped Claude instructions
  .claude/settings.json                        # hook registration

dashboard/                                     # new, this spec
  app/
    page.tsx                                   # Home
    projects/[slug]/page.tsx                   # Project
    agents/page.tsx
    settings/page.tsx
    api/
      projects/route.ts
      projects/[slug]/route.ts
      issues/route.ts
      issues/[id]/route.ts
      issues/[id]/start/route.ts
      issues/[id]/stop/route.ts
      runs/[id]/route.ts
      agents/route.ts
      agents/[slug]/route.ts
      hooks/event/route.ts
      runtime/socket/route.ts                  # WS endpoint
      settings/route.ts
  components/
    home/
    project/
    issue/
    agents/
    settings/
    common/
  lib/
    db.ts
    projects.ts
    agents.ts
    issues.ts
    runs.ts
    threads.ts
    worktrees.ts
    settings.ts
    runtime/
      spawn.ts
      registry.ts
      claude-code.ts
  scripts/
    migrate-to-0002.ts
  package.json

dashboard-v1/                                  # the current dashboard, preserved
  ...

.agentic-os/
  state.db
  settings.json
```

The `<workspaceRoot>` default is `~/code/` on Linux and macOS, `%USERPROFILE%\code\` on Windows. Configurable in Settings. Existing projects with a `path:` outside the workspace root are honored as-is (the workspace root only governs new clones).

### UI surfaces

**Home.** Top: running-sessions strip. Compact cards, one per active run, showing project name, issue title, agent name, elapsed time, status dot. Click a card to open the Issue slide-over with that run's xterm visible. The strip is empty by default (no padding) when nothing is running.

Below the strip: project list. Cards sorted by last-activity desc. Each card has name, workspace path (truncated), open-issues count, running-issues count, last-activity timestamp. Right side of each card: a kebab menu with "Open", "Archive", "Edit metadata."

Top-right of Home: "+ New Project" button with a dropdown of two options: "Clone from GitHub" (prompts for URL, optional override path), "Link existing folder" (prompts for absolute path).

**Project page (`/projects/[slug]`).** Header: project name, workspace path, repo URL (if any), runtime-default badge, "+ New Issue" button. Body: left two-thirds is the kanban (Backlog, Queued, Running, Review, Done), drag-and-drop between columns. Right one-third is the crew roster: list of agents on this project with skill chips, "Edit crew" button.

Crew picker slide-over: lists all agents in `agents/` whose `skills:` intersect the project's `capabilities:`. Checkboxes to add or remove. "Save" writes `crew:` back to `PROJECT.md`.

**Issue slide-over.** Opens from a kanban card. Three sections, vertically stacked, scrollable.

1. Issue: title (editable inline), body (markdown editor), assignee selector (filtered to crew), priority, labels, mode toggle (sync / async), status badge.
2. Thread: append-only chronological list of comments and events. Comment box at the bottom for the operator. Events (run started, run ended, hook fired, status changed) render with a distinct style.
3. Runs: a tab strip with one tab per run, newest first. Active run's tab shows the live xterm (mounted on tab open, scrolls back through the ring buffer). Old runs show a "Replay transcript" button that opens the JSONL transcript in a viewer.

Footer of the slide-over has the state-machine action buttons. Backlog → "Move to Queued". Queued → "Start" (creates a run, spawns PTY). Running → "Stop" (signals SIGINT, then SIGKILL after 5s; sets `exit_status='killed'`), "Open in terminal." Review → "Mark Done" or "Reopen". Done / Failed → "Reopen".

**Agents page (`/agents`).** Table of all agents: name, runtime, skill chips, "used by N projects" pill, last-edited timestamp. Click a row to open an edit drawer: name, slug (read-only after creation), runtime selector, allowed-tools chip-input, skills chip-input, system-prompt textarea. Save writes back to `agents/<slug>.md`. "New Agent" creates a blank profile.

**Settings page (`/settings`).** Sections:

- Workspace: `workspaceRoot` text input, "Browse" button.
- Concurrency: `perProjectMax`, `globalMax` number inputs.
- Runtimes: list of registered runtimes from `lib/runtime/registry.ts`. Each row: id, cli, detected (yes/no), version, "Enable" toggle (Phase 6).
- Hooks: read-only display of the hook config that needs to be in `.claude/settings.json` (or per-project), with a "Copy" button.
- Theme: light / dark / system.

**Sidebar nav.** Home, Agents, Settings. Three items. The Project page is reached only through Home. The Issue slide-over is reached only through a Project page.

### Schemas summary

YAML frontmatter schemas formally:

```
PROJECT.md:
  name: string
  slug: string                       # filesystem-safe
  path: string                       # absolute
  repo: string?                      # URL
  crew: string[]                     # agent slugs
  runtime-default: string            # runtime id
  capabilities: string[]
  allow-parallel-edits: bool?        # default false
  created: ISO date

agents/<slug>.md:
  name: string
  slug: string
  runtime: string                    # runtime id
  allowed-tools: string[]
  skills: string[]
  created: ISO date
```

SQLite tables: `projects` (mirror of PROJECT.md, watched), `agents` (mirror of agents/, watched), `issues`, `runs`, `hook_events`, `settings_kv`.

`projects` and `agents` are denormalized into SQLite to make joins cheap but the source of truth stays in the markdown files (file watcher reconciles on change).

## Migration

`dashboard/scripts/migrate-to-0002.ts`. Runs once, idempotent. Steps:

1. Refuse to run if `.agentic-os/migrations/0002.done` exists.
2. Read every `agents/**/<name>.md` (recursive). For each:
   - Parse frontmatter. Derive `skills:` from existing `department:` + any keywords in description (mapping table in the script).
   - Set `runtime: claude-code`.
   - Drop `department:`.
   - Write to `agents/<slug>.md` (flat).
3. Remove the old department folders if empty.
4. Read every `vault/projects/*/PROJECT.md`. For each:
   - Set `runtime-default: claude-code` if absent.
   - Set `crew: []` if absent (operator fills in via UI).
   - Add `capabilities:` if absent (derive from existing notes if possible, otherwise leave empty).
5. Open `.agentic-os/state.db`. Apply schema migrations:
   - Drop `teams`, `lead_routes`, `team_members` if present.
   - Rename `tasks` to `issues`, add `mode` column (default 'async'), preserve all rows.
   - Add columns to `runs`: `runtime_id` (default 'claude-code'), `pty_session_id`, `worktree_path`.
   - Create `hook_events` if absent.
6. Write `.agentic-os/migrations/0002.done` with a timestamp.
7. Print a summary: N agents migrated, M projects updated, K tables altered.

Rollback: keep `dashboard-v1/` intact and an SQLite backup at `.agentic-os/state.db.pre-0002.bak`. The migration script makes that backup before touching the DB.

## Build phases

Each phase ends with a real use case advancing on the QML healthcare diagnostics project (or current most-active research project).

**Phase 1: data model, migration, read-only Home.** Implement `lib/db.ts`, `lib/projects.ts`, `lib/agents.ts`. Write `migrate-to-0002.ts`. Build Home page that lists migrated projects. No execution yet. Definition of done: open the dashboard, see your 12 existing projects listed correctly. The QML project page opens and shows the right path and crew (empty for now).

**Phase 2: project page, issue CRUD.** Build Project page with kanban (drag-and-drop), crew sidebar, "Edit crew" slide-over. Build Issue slide-over with the issue section and thread section (no runs yet). API routes for issues. Definition of done: file an issue against the QML project, assign it, drag through states by hand.

**Phase 3: runtime + PTY + xterm.** Implement `lib/runtime/{spawn,registry,claude-code}.ts`. Add `lib/worktrees.ts`. WebSocket at `/api/runtime/socket`. xterm.js in the Issue slide-over runs tab. "Start" button works. Definition of done: file an issue on the QML project ("draft the related-work section"), assign it to lit-reviewer, click Start, watch the agent work in the dashboard, get a draft committed to the worktree's branch.

**Phase 4: agents page, crew management.** Agents page with edit drawer. Crew picker filters by capabilities-skills intersection. Definition of done: edit the lit-reviewer agent's system prompt from the dashboard, run another issue, see the prompt change reflected.

**Phase 5: hooks.** SessionStart and SessionEnd hooks POST to `/api/hooks/event`. Run state and the runs table reflect honest start/end. Threads get auto-events. Definition of done: kill `claude` from inside the terminal mid-session, see the dashboard's run transition to Failed with `exit_status='error'`.

**Phase 6: settings, caps, cost visibility.** Settings page wired. Concurrency caps enforced (Start button disables with tooltip). Header strip on dashboard shows live agent count and approximate cost. Definition of done: try to start 4 issues on QML when cap is 3, see the 4th refused.

**Phase 7: second runtime.** Add `lib/runtime/codex.ts` (or whichever CLI is next). Registry shows it. Create an agent profile with `runtime: codex`. Definition of done: run one issue with Codex end-to-end on a non-QML project.

After Phase 7, this spec is closed. Further work happens against new specs.

## Risks and open questions

- Hook correlation. The plan assumes the hook's session id can be matched to the spawned PTY by recency in the worktree. If two PTYs spawn in the same worktree within milliseconds, correlation could collide. Mitigation: spawn one at a time per worktree, which is already enforced (one issue, one worktree).
- Windows PTY behavior with `node-pty` is generally fine but specific edge cases (resize signals, color escape sequences with certain locales) can surface. Phase 3 includes a manual smoke test on Windows before declaring done.
- The `--allowed-tools` flag's exact name and behavior on the current Claude Code version needs verification against `claude --help` output at Phase 3 kickoff. If the flag has changed names, update `lib/runtime/claude-code.ts` accordingly. Same for `--add-dir` and `--append-system-prompt`.
- The "open in terminal" escape hatch on Windows relies on `wt.exe` being on PATH. If Windows Terminal is not installed, fallback to spawning a basic `cmd.exe` with `claude --resume`.
- Resume of an async run after dashboard restart. Phase 3 spawns PTYs as child processes of the dashboard server. If the dashboard restarts, those PTYs die. Acceptable for v1; Phase 5+ could detach into background processes managed by a separate supervisor. Out of scope for this spec.
- The Claude Code billing posture (interactive vs `-p`) is current as of 2026-05-20. If Anthropic changes the model post-cutover, the runtime layer is the only thing that needs to adapt, which is the whole point of isolating it.

## References

- `plan.md`: original design. Layers 0-2 remain authoritative for this spec. Layer 3 is replaced by this document.
- `product/roadmap.md`: Phases 1-5 remain authoritative. Phases 6-9 are superseded.
- `multica-ai/multica`: inspiration for the projects / issues / agents / runtimes model. We borrow the data model; we do not borrow the Go daemon (Next.js + node-pty is enough for one operator).
- Claude Code interactive CLI documentation (current as of 2026-05): `claude --help`, `--add-dir`, `--allowed-tools`, `--append-system-prompt`, `--resume`, hook configuration in `.claude/settings.json`.
- `agents/`, `skills/`, `vault/`, `standards/`, `instructions/`, `product/`, `references/`, `.claude/commands/`: preserved without changes (apart from agent profile schema updates handled by the migration script).
