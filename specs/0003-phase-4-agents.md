# Path A Reset, Phase 4 Spec: Agents Page and Reliability Polish

> **Status:** Draft. Extends spec 0002, replacing the one-paragraph Phase 4 section there with a full design. Targets implementation after Phase 3 (`docs/plans/2026-05-20-path-a-reset-phase-3.md`) lands.

> **Skill basis:** `superpowers:brainstorming` was invoked implicitly through the Phase 3 self-review (which surfaced Phase 4's reliability gaps). One round of `ask_user_input_v0` is queued at the end of this spec for the two genuinely open decisions; the rest are locked here with rationale.

## Why this phase exists

After Phase 3, agents run end-to-end inside worktrees. The Agents page from Phase 1 is still a stub: it reads the markdown files in `vault/agents/` and lists them, nothing more. The actual workflow of editing an agent's skills or runtime, creating a new agent, or finding out which projects a given agent has worked on, requires opening Obsidian and hand-editing frontmatter. The dashboard pretends agents are a primitive but doesn't yet treat them like one.

Phase 3 also closed with three reliability gaps in its self-review that don't fit neatly into Phases 5 through 7. Orphaned runs after server restart compounds over time (the runs table accumulates rows with `ended_at IS NULL` that block the concurrency cap). No way to send a follow-up message to a running agent forces context switches out to the external terminal. Worktree cleanup after Done is a manual `git worktree remove` away. Phase 4 picks these up while we're already in the agents area of the codebase.

## Goal

Operating Agentic-OS for two weeks without needing to manually edit any markdown file in `vault/agents/` or `vault/projects/<slug>/PROJECT.md`, and without needing to manually run `git worktree prune` after the dashboard restarts mid-run.

## In scope

1. Agents page (real version): list with skill filter, click-through to agent profile, "+ New Agent" form, inline edit on profile.
2. Agent profile page at `/agents/<slug>`: shows skills, capabilities, runtime, allowed-tools, projects this agent appears in, recent runs across projects.
3. Cross-project run history endpoint and component (`/api/agents/<slug>/runs`).
4. Stale run reaper: on dashboard boot, any run with `ended_at IS NULL` whose process is no longer live gets marked as failed with `exit_status = "orphaned"`.
5. Mid-run "Send message" composer in the issue drawer's Runs tab: typed text gets piped into the active PTY without leaving the dashboard.
6. Worktree cleanup convenience: when an issue moves to Done via the kanban (drag or button), the dashboard offers a "Remove worktree" prompt that runs the cleanup if confirmed.
7. Minor: agent slug uniqueness validation (the migration script in Phase 1 assumed unique slugs but never enforced it).

## Out of scope

- Cost or token-usage attribution per agent (Phase 6).
- Full hooks system beyond SessionStart (Phase 5).
- Second runtime (Phase 7).
- LightRAG or any external knowledge layer (parked at `docs/roadmap/lightrag-mcp.md`).
- Agent permissions or access control. The dashboard remains single-operator.
- Bulk-edit operations across multiple agents (deferred until a use case emerges).
- Archive or soft-delete for agents. If you stop using an agent, remove it from project crews; the file can stay on disk.

## Architecture additions

### Data layer

No schema changes. The runs table from Phase 1 already supports cross-agent queries (it has `agent_slug`). The agents table doesn't exist (agents are markdown files); listing them is already covered by `lib/agents.ts` from Phase 1. The mid-run send and worktree cleanup features both use existing infrastructure (PTY write, `lib/worktrees.removeWorktree`).

### Stale run reaper

A new function `reapStaleRuns()` in `lib/runs.ts` runs once at server boot, before the watcher starts. Implementation: query `SELECT id, worktree_path FROM runs WHERE ended_at IS NULL`. For each row, the dashboard cannot reliably tell whether the PTY process is still alive, since the process belongs to a previous server invocation. Solution: any active-but-orphaned run found at boot is marked failed unconditionally. Rationale: if the server restarted, the live PTY is gone (process tree died with the parent). Any "still running" rows are by definition stale.

Side effects:
- Issue status transitions: each orphaned run's issue gets `status = "failed"` if currently `running`, otherwise unchanged.
- Thread events appended: `run.orphaned` with detail "Run N was active when the dashboard restarted; marked as failed."
- Worktrees are NOT auto-removed by the reaper. The operator decides via the manual worktree management UI (Phase 3 Task 14).

### Mid-run send

The Runs tab's xterm.js panel already has WebSocket access (Phase 3 Task 8). The "Send message" composer below the terminal is a separate React component that, on submit, calls `ws.send(JSON.stringify({ type: "data", data: text + "\r" }))`. The PTY receives it as if the operator had typed in xterm directly.

Side effects:
- The submitted text gets appended to the thread as a comment with author = "operator (mid-run)". Rationale: visible audit trail. The operator can always see what they nudged the agent with.
- Empty submissions are rejected client-side.
- No rate limiting; the operator is trusted.

### Agents page (real version)

Three new UI surfaces, all client components:

**`/agents`** (replaces the Phase 1 stub): grid of agent cards. Each card shows name, slug, runtime badge, skill chips, count of projects this agent is in. Filter bar at the top: free-text search by name/slug, multi-select skill filter. "+ New Agent" button opens `NewAgentDialog`.

**`/agents/<slug>`** (new): full agent profile. Header with name, slug, edit/delete buttons. Three sections: Profile (frontmatter fields as a form, with inline edit), Projects (list of projects in whose crew this agent appears, with link to each), Runs (chronological list of recent runs across all projects with status pills and link to the issue).

**`NewAgentDialog`** (modal): form for creating an agent. Required fields: name, slug (auto-generated from name, editable). Optional: runtime (defaults to `claude-code`), skills (free-text input with inferred suggestion chips below, per locked decision D1), allowed-tools (text input, advanced). Submit writes `vault/agents/<slug>.md` with frontmatter and a placeholder body.

### Worktree cleanup convenience

When an issue moves to status `done`, the dashboard checks if a worktree exists for any of the issue's runs (most recent run's `worktree_path`). If yes, a toast notification with two actions appears: "Keep worktree" (default, dismisses toast) or "Remove worktree" (calls the existing `DELETE /api/projects/<slug>/worktrees?path=...` endpoint).

Crucially: this is opt-in per status transition, not automatic. Auto-removal on Done was rejected in the Phase 3 brainstorm because it risks losing work the operator hasn't inspected yet.

### Slug uniqueness validation

The `lib/agents.ts` `parseAgentFile` function already extracts the slug from filename. Phase 4 adds a startup check in `ensureServerBooted` that calls `listAgents()` and warns to stderr if any slug appears twice. Doesn't error; agents page shows a warning banner if duplicates exist.

## Schema changes

None.

## New files (planned, will be elaborated in the Phase 4 plan)

```
dashboard/
  app/
    agents/page.tsx                          # REPLACE: real agents page
    agents/[slug]/page.tsx                   # NEW: agent profile
    api/
      agents/route.ts                        # MODIFY: add POST (create agent)
      agents/[slug]/route.ts                 # NEW: GET, PATCH, DELETE
      agents/[slug]/runs/route.ts            # NEW: GET cross-project runs
  components/
    agents/
      AgentCard.tsx                          # NEW
      AgentFilterBar.tsx                     # NEW
      NewAgentDialog.tsx                     # NEW
      AgentProfileHeader.tsx                 # NEW
      AgentProfileForm.tsx                   # NEW
      AgentRunsSection.tsx                   # NEW
      AgentProjectsSection.tsx               # NEW
      SkillInput.tsx                         # NEW: text input + suggestion chips (D1)
    issue/
      MidRunComposer.tsx                     # NEW: sends to PTY mid-run (D2: appends \r)
    project/
      WorktreeCleanupToast.tsx               # NEW: prompted on Done
  lib/
    agentMutations.ts                        # NEW: createAgent, updateAgent, deleteAgent
    runs.ts                                  # MODIFY: add reapStaleRuns()
    server-init.ts                           # MODIFY: call reapStaleRuns on boot
  tests/
    agentMutations.test.ts
    reapStaleRuns.test.ts
```

## Acceptance criteria

These mirror the A-series criteria from 0002 but with a B prefix for Phase 4.

**B1.** From Home, click "Agents" in the sidebar (added in Phase 1 placeholder). The page lists all agents from `vault/agents/*.md` as cards. Each card shows name, slug, runtime, top-3 skills, and a count like "in 4 projects".

**B2.** On the agents page, type into the search bar. Cards filter in real-time by name or slug substring. Select skills from the multi-select. Cards filter to only those whose `skills:` intersect the selected set.

**B3.** Click an agent card. Navigates to `/agents/<slug>`. The profile page shows three sections: Profile, Projects, Runs. Each section loads independently with its own spinner.

**B4.** On the agent profile, the Profile section shows all frontmatter fields. Click "Edit". The fields become editable inputs. Modify skills, click Save. The page refreshes. Open `vault/agents/<slug>.md` directly; the frontmatter reflects the change. The watcher fires a `agent.changed` event so any other open tabs (agents page, project crew pickers) re-fetch.

**B5.** On the agent profile, the Projects section lists every project whose `crew:` includes this agent. Each entry links to that project page.

**B6.** On the agent profile, the Runs section lists the most recent 20 runs by this agent across all projects, ordered newest first. Each shows the project, the issue title, status pill, started/ended timestamps. Click a run to navigate to its issue.

**B7.** On the agents page, click "+ New Agent". A modal asks for name, slug (defaults to slugified name), runtime, skills. The skills input is a text field with a row of clickable suggestion chips below it showing existing skills across all agents; clicking a chip appends it. Click Create. The modal closes. A new card appears in the agents page within ~1s (via watcher SSE). Open `vault/agents/<new-slug>.md` directly; the file exists with the entered frontmatter.

**B8.** Trying to create an agent with an existing slug returns a 409 from the API; the modal shows "Slug already in use".

**B9.** Restart the dashboard while a run is active. After restart, open the issue. The run shows status `failed` with reason "orphaned". The thread shows a `run.orphaned` event. The issue status is `failed` (assuming it was `running` at the time of restart).

**B10.** Start a run. While the agent is working, type a message into the "Send message" composer below the xterm panel and click Send. The text appears in xterm (typed into the agent's prompt) and as a new thread comment by author "operator (mid-run)".

**B11.** On a project page, drag an issue from Review to Done. A toast appears: "Issue done. Remove the worktree at `<path>`?" with "Keep" and "Remove" buttons. Click Remove. The toast dismisses; the worktree disappears from the project's worktree list within ~1s.

**B12.** Two agents have the same slug (manually duplicated for testing). On dashboard boot, stderr shows a warning. The agents page shows a banner: "Duplicate agent slugs detected: `<slug>`. Resolve by renaming one of the files." The banner persists until the duplicates are gone.

## Verification scenarios

The phase-level definition of done is a 30-minute walkthrough where the operator:

1. Creates a new agent on the agents page from scratch (B7).
2. Edits its skills (B4).
3. Adds the agent to a project crew via the existing crew picker.
4. Files an issue, assigns it to the new agent, clicks Start.
5. Mid-run, sends a follow-up message via the composer (B10).
6. Stops the run (or lets it finish).
7. Marks the issue Done; accepts the worktree cleanup prompt (B11).
8. Restarts the dashboard mid-flow on a second issue to verify the reaper (B9).
9. Confirms the agent's profile page shows both completed runs across both issues (B6).

All without opening Obsidian or running a git command.

## Decisions locked (May 2026)

Both questions were delegated to me with "do what's best." Recording the reasoning so the choice is auditable.

**D1: Skill input is free-text with inferred suggestion chips below the input.**

The chip-picker-against-inferred-vocabulary option is genuinely the better UX, but the practical value of strict enforcement is low when one operator is creating all the agents and would catch typos on review. The compromise that captures 90% of the chip-picker benefit at 20% of the code: a plain text input where the operator types comma-separated skills, with a row of small clickable chips below the input showing the union of skills across all existing agents. Clicking a chip appends it to the input. New skills can be typed directly; the suggestion row updates after save.

Implementation: `NewAgentDialog` and `AgentProfileForm` both render a `<SkillInput>` component that takes the current list of known skills (passed in from the parent, which fetched them via `/api/agents`). Rendering cost is one row of chips; no separate vocabulary store.

**D2: Mid-run composer appends `\r` automatically on Send.**

The alternative (don't append, let the operator press Enter in xterm) makes the Send button misleading. The composer exists for the common case of "type a follow-up and hit submit." Operators who want multi-line input or hold-Enter behavior can type directly into xterm where they have full control. The composer is the convenience path; we optimize for that path.

Implementation: `MidRunComposer` submit handler sends `{ type: "data", data: text + "\r" }` over the existing WebSocket. The thread comment is appended with the original text (no `\r`), since the carriage return is a transport detail not worth surfacing in the audit trail.

## Risks

1. **Slug rename is a destructive operation.** If the operator changes an agent's slug via the edit form, every PROJECT.md that references it in `crew:` becomes stale. Phase 4 should either disallow slug edit (file rename outside the dashboard) or cascade the rename across all PROJECT.md files. Defaulting to disallow; slug is treated as immutable in the edit form. Renaming requires file rename via OS.

2. **Stale run reaper could flag a legitimately long run as orphaned.** If the dashboard is restarted while an agent is mid-task, the agent's PTY dies because it was a child of the dashboard process. So "orphaned" is always correct in practice. The risk is purely cosmetic (the operator might be confused). Mitigation: the thread event message is explicit.

3. **Mid-run send racing with the agent's own output.** The composer types into the PTY. If the agent is mid-stream, the typed characters interleave with the agent's output in xterm. xterm.js handles this fine (it's just a terminal emulator), but the visual effect can be confusing. Mitigation: brief styling in the composer that says "Sends directly to the agent's prompt."

4. **Worktree cleanup toast timing.** The toast fires on the `issue.changed` SSE event with status transitioning to `done`. If the operator marks Done from a different tab, the toast appears on the original tab too. Acceptable; the operator can dismiss.

5. **Cross-project run history scale.** If an agent has hundreds of runs, the profile's Runs section blows out. Mitigation: limit to 20 most recent on initial load, "Load more" button. No pagination beyond that.

## Build sub-phases (sketch for the plan)

A future Phase 4 plan will break this into ~10 tasks. Likely order:

1. Stale run reaper (data layer, fastest reliability win).
2. Agent mutations library (`createAgent`, `updateAgent`).
3. API routes for agent CRUD.
4. Agents page real version with filter bar.
5. Agent profile page (Profile section).
6. Agent profile page (Projects section).
7. Agent profile page (Runs section + `/api/agents/<slug>/runs` endpoint).
8. New Agent dialog.
9. Mid-run composer.
10. Worktree cleanup toast.
11. Slug uniqueness check + duplicate banner.
12. Phase 4 verification.

## References

- Spec 0002 (`specs/0002-path-a-reset.md`), Phase 4 paragraph.
- Phase 3 plan self-review (`docs/plans/2026-05-20-path-a-reset-phase-3.md`, "Known gaps to fix in Phase 4 or later").
- LightRAG roadmap (`docs/roadmap/lightrag-mcp.md`), confirms LightRAG is parked and not blocking Phase 4.
