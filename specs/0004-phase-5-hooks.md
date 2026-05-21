# Path A Reset, Phase 5 Spec: Full Hooks Integration

> **Status:** Draft. Extends spec 0002, which described Phase 5 as "ship the full hooks system" in one paragraph. Targets implementation after Phase 4 plan lands.

> **Skill basis:** Brainstorming surfaced during the Phase 3 self-review (which used SessionStart only) and the Phase 4 spec (which marked hooks as deferred). Three genuinely open decisions are queued at the end via `ask_user_input_v0`; the rest are locked here with rationale.

## Why this phase exists

Phase 3 installed exactly one hook (SessionStart) for one narrow purpose: capturing the session_id so "Open in terminal" could work. Claude Code's hook system has eight other event types that Agentic-OS currently ignores. Every tool the agent invokes, every prompt it receives, every stop, every context compaction, all of it passes by without the dashboard noticing.

Without these, the only record of what an agent did is the xterm replay. The xterm is a terminal recording, not a structured log. If you close the drawer mid-run and come back later, you have to scroll through the replay to figure out what happened. If a run goes wrong, you have no audit trail beyond "the agent did some stuff and exited with code 1." Phase 5 makes the dashboard a real observer.

## Goal

After Phase 5, closing the issue drawer mid-run and coming back later, you can reconstruct exactly what happened from a structured timeline: which prompts the agent received, which tools it called and with what arguments, which results came back, when context was compacted, when it stopped. The xterm replay still shows the terminal as it appeared; the hook timeline tells the structured story.

## In scope

1. Generalize `installSessionStartHook` from Phase 3 into `installAllHooks` writing entries for all relevant Claude Code hook events.
2. Persist every hook event to the `hook_events` table (created in Phase 1, used here for the first time).
3. Consolidate the Phase 3 hook callback endpoint to accept the full hook surface with an `eventName` discriminator.
4. UI: hook timeline component in the issue drawer (separate tab; see locked decision below for placement reasoning).
5. Thread injection of significant lifecycle events (SessionStart, SessionEnd, Stop, PreCompact). Tool-call events and prompts go to the timeline tab only, not the thread.
6. PreCompact handling: snapshot the transcript jsonl file to `vault/projects/<slug>/runs/<run-id>/pre-compact-<timestamp>.jsonl` before the context window loses fidelity.
7. Soft policy enforcement: on PreToolUse, compare the tool name against the agent's `allowed-tools` frontmatter; if violated, log a thread event. Do not block.
8. Hook event search: a small filter bar on the timeline tab (by event type, by tool name).

## Out of scope

- Hard policy enforcement (actually blocking tools). Claude Code's PreToolUse hook can return a non-zero exit to block, but blocking changes the agent's runtime semantics and operators may not expect that. Phase 5 observes only. Hard blocking is a future phase or a manual feature flag.
- Cost or token attribution per tool call (Phase 6).
- Hook events from sources other than the agent's own claude-code instance. Subagent hooks (`SubagentStop`) are captured but no special handling; they appear in the timeline alongside parent events.
- Multi-tenant isolation. The dashboard is single-operator throughout.

## Architecture additions

### Hook events table (already exists from Phase 1)

```sql
CREATE TABLE hook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  hook_event_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id)
);
```

Phase 5 finally writes to it. The `payload_json` column holds the raw hook input JSON (whatever Claude Code sends to the hook script's stdin). Schema stays open-ended on purpose: hook payloads change between Claude Code versions, and we don't want to rev the database every time.

### Generalized hook installer

`lib/runtime/hookInstaller.ts` currently has `installSessionStartHook(opts)`. Phase 5 adds `installAllHooks(opts)` which writes a `settings.local.json` containing entries for every hook event Agentic-OS cares about. The list:

```
SessionStart, SessionEnd, PreCompact, PreToolUse, PostToolUse,
UserPromptSubmit, Stop, Notification, SubagentStop
```

Each entry fires the same hook script with the event name appended as an additional positional argument. The script reads stdin JSON, posts `{ runId, eventName, payload }` to the dashboard.

### Hook script extension

`dashboard/scripts/claude-session-hook.js` from Phase 3 gets a new positional arg. Current invocation:
```
node hook.js <callbackUrl> <runId>
```

New invocation:
```
node hook.js <callbackUrl> <runId> <eventName>
```

The script reads the event name from `process.argv[4]` and includes it in the POST body. Existing SessionStart-specific logic (extracting session_id from payload) becomes one of several event-specific handlers.

### Hook callback API consolidation

Phase 3's `/api/runs/[id]/hook` accepts `{ runId, sessionId, transcriptPath }`. Phase 5 changes the schema to `{ runId, eventName, payload }`. Backwards compatibility: SessionStart's payload still contains `session_id` and `transcript_path`, and the route still extracts those and calls `attachSessionId` plus `updateRun` accordingly. Other events store the payload to `hook_events`, optionally do event-specific side effects (thread append, transcript snapshot, policy check), and return 204.

The route handler dispatches on `eventName`:
- `SessionStart`: existing Phase 3 logic plus persist to hook_events
- `SessionEnd`: persist, append thread event, no other side effect
- `PreToolUse`: persist, run policy check, append `policy.violation` thread event if applicable
- `PostToolUse`: persist only (no thread injection, would be too noisy)
- `UserPromptSubmit`: persist only (the prompt itself shows in xterm)
- `Stop`: persist, append thread event
- `Notification`: persist, no side effect
- `PreCompact`: persist, copy `transcript_path` to snapshot location, append thread event
- `SubagentStop`: persist only

### Soft policy enforcement

On PreToolUse:
1. Read the run record, get `agent_slug`.
2. Read agent frontmatter LIVE via `lib/agents.getAgent(slug)` (not cached from run start; honors locked decision D4 below: mid-run edits to `allowed-tools` apply immediately).
3. Get `allowed-tools`. If missing or empty, allow everything.
4. If non-empty: check whether `payload.tool_name` is in the list. Case-insensitive comparison (per risk #3 below).
5. If not allowed: append a thread event with type `policy.violation`, details `"Agent <slug> used <tool_name>, which is not in its allowed-tools list."`.

This is observation, not enforcement. The agent runs the tool either way. Operator sees the violation in the thread and decides whether to update permissions, revoke the agent, or shrug.

### PreCompact transcript snapshot

When PreCompact fires, the hook payload contains a `transcript_path` field pointing to the agent's `.jsonl` history file. The route handler:
1. Reads the run record to get `worktree_path` and project slug.
2. Copies the file to `vault/projects/<slug>/runs/<run-id>/pre-compact-<unix-timestamp>.jsonl`.
3. Appends a thread event `transcript.snapshot` with details `"Pre-compact snapshot taken: <path>"`.

Why snapshot before compaction: Claude Code's auto-compact summarizes earlier conversation when the context window fills up. The summary is lossy. If you want to do retrospective analysis (token usage, tool patterns, time-on-task) after the run ends, you need the full transcript, not the summary. PreCompact is the last moment to grab it.

Retention: snapshots stay until manually deleted. Operator can clean up via filesystem if disk space matters; Phase 5 does not implement auto-cleanup.

### UI: Hook events timeline tab

A new tab in the issue drawer, sitting next to Issue / Thread / Runs / Events. The Events tab shows a vertical list of hook events for the most recent run on the issue (or all runs, with a run selector). Each row shows:
- Timestamp (relative, e.g., "3 minutes ago")
- Event name (color-coded by category: lifecycle blue, tool yellow, prompt green, notification gray)
- One-line summary derived from payload (e.g., `PreToolUse: Bash("npm test")` or `UserPromptSubmit: "Add tests for the new endpoint..."` truncated to 80 chars)
- Click expands to show full payload JSON

A filter bar at the top: text search across the summary, multi-select event types.

The timeline does NOT auto-scroll on new events. Phase 3's xterm auto-scrolls; the operator can switch tabs to follow either view.

## Schema changes

None.

## New files

```
dashboard/
  app/
    api/
      runs/[id]/hook/route.ts                    # MODIFY: extend to all events
      runs/[id]/events/route.ts                  # NEW: GET hook events for a run
      issues/[id]/events/route.ts                # NEW: GET events across all runs on an issue
  components/
    issue/
      EventsTab.tsx                              # NEW: new tab content
      EventList.tsx                              # NEW
      EventRow.tsx                               # NEW
      EventFilterBar.tsx                         # NEW
      EventPayloadView.tsx                       # NEW: pretty-print JSON
    issue/
      IssueDrawer.tsx                            # MODIFY: add Events tab
  hooks/
    useRunEvents.ts                              # NEW: SSE-backed events stream
  lib/
    runtime/
      hookInstaller.ts                           # MODIFY: add installAllHooks
    hookEvents.ts                                # NEW: data layer for hook_events table
    policy.ts                                    # NEW: allowed-tools checks
  scripts/
    claude-session-hook.js                       # MODIFY: accept event name arg
  tests/
    hookEvents.test.ts
    policy.test.ts
    hookInstaller-multi.test.ts                  # extends existing
```

## Acceptance criteria

C-series for Phase 5.

**C1.** Start a run on any issue. The issue's Events tab populates within seconds with at least one event (SessionStart). The event row shows timestamp, name "SessionStart", and a summary like "Session abc12345 started in /path/to/worktree".

**C2.** While the agent is working, type a prompt directly into xterm. Within ~1s, a `UserPromptSubmit` event appears in the Events tab with the prompt text in the summary (truncated if long).

**C3.** When the agent uses a tool (e.g., Bash), both `PreToolUse` and `PostToolUse` events appear. The PreToolUse summary shows the tool name and a short arg preview. The PostToolUse shows tool name and a short result preview. Click a PreToolUse row; expanded view shows full payload JSON with tool input.

**C4.** Click on a `PostToolUse` event row. Expanded view shows the tool's result (truncated if very large), the exit status if applicable, and timing info.

**C5.** Configure an agent with `allowed-tools: [Read, Edit]` in its frontmatter. Start a run that uses `Bash`. A `policy.violation` thread event appears (visible in the Thread tab) saying the agent used `Bash` which is not in its allowed-tools list. The run continues normally; the tool call succeeded.

**C6.** Trigger a long-running session that hits auto-compact (or use `/compact`). A `PreCompact` event appears in the Events tab. Check `vault/projects/<slug>/runs/<run-id>/`; a `pre-compact-<timestamp>.jsonl` file exists with the pre-compaction transcript.

**C7.** In the Events tab, type "Bash" in the filter bar. The list filters to only events whose tool name or summary matches. Uncheck "PostToolUse" in the type filter; only PreToolUse events for Bash show.

**C8.** A run ends. Both `Stop` and `SessionEnd` events appear in the Events tab. The Thread tab shows lifecycle markers for SessionStart and SessionEnd (Stop is implicit and does NOT get a thread event; it's tool-noise level).

**C9.** Open the Events tab for an issue with multiple completed runs. A run selector at the top of the tab lets you switch which run's events are shown. Default: most recent run.

**C10.** Stop the dashboard mid-run. The agent's hook callbacks to `/api/runs/<id>/hook` return connection errors (server is down). Restart the dashboard. The events that were in-flight during the outage are lost (Claude Code doesn't queue failed hook deliveries). This is expected; the Events tab does not claim to be a guaranteed log.

## Verification scenarios

The phase-level walkthrough is one rich run:

1. File an issue against any project. Assign to an agent that has both `Read` and `Bash` in its allowed-tools list.
2. Start the run.
3. Watch the Events tab populate as SessionStart fires, then the agent processes the initial prompt (UserPromptSubmit), then it starts using tools (PreToolUse/PostToolUse pairs).
4. Switch to the Thread tab; confirm lifecycle markers are there but tool calls are NOT cluttering the thread.
5. From xterm, type a follow-up to the agent. Confirm a UserPromptSubmit event appears.
6. Edit the agent's allowed-tools mid-run to remove Bash. The next time the agent uses Bash, a policy.violation appears in the thread.
7. Let the session run long enough to compact (or invoke `/compact`). Verify the PreCompact snapshot file appears on disk.
8. Stop the run. Confirm Stop and SessionEnd events in the timeline.
9. Reload the page; the Events tab repopulates from the database (not from in-memory state). Same events present.

## Locked decisions (May 2026)

Two batches: the first five decided based on Phase 1-4 context and Claude Code hook documentation; the last three (D3, D4, D5) decided after operator review.

### First batch: foundational design

**Hook event storage is the database, not the thread file.** The thread file is for human-readable narrative (operator comments, lifecycle markers). Hook events are structured machine data with potentially large payloads. Putting every tool call in the thread file would balloon it and reduce the signal-to-noise. The thread file gets only the lifecycle markers; the database holds everything.

**The UI surface is a dedicated Events tab, not interleaved with Thread.** Two reasons. First, interleaved would force the operator to filter thread comments out of tool events constantly. Second, the Thread tab is the channel the operator uses to communicate with the agent (via the composer); cluttering it with machine events makes that communication harder to find. A separate Events tab is the cleaner separation.

**Lifecycle events also appear in Thread.** SessionStart, SessionEnd, Stop, PreCompact mark important state transitions the operator should see without switching tabs. These get thread events. Tool calls and prompts stay in the Events tab.

**Policy enforcement is soft only.** Hard enforcement (blocking tool calls) changes the agent's runtime contract in a way operators might not expect. Soft warnings preserve the agent's freedom while giving the operator visibility. If hard blocking is wanted later, it's a one-line change in the PreToolUse handler (return non-zero from the hook script) and a per-agent or per-project flag.

**PreCompact snapshots are retained indefinitely.** Disk space is cheap; transcripts are small. Auto-cleanup is the kind of feature that's only useful if you have thousands of runs, and even then the operator can clean up with `rm -rf` faster than a UI lets them.

### Second batch: operator-confirmed (D3, D4, D5)

**D3 (locked): Full payload storage in the database.**

Operator selected this directly. Estimated growth is around 100 MB per year of moderate use, which SQLite handles comfortably and disk cost is negligible. No truncation, no spillover files, no schema gymnastics. If growth ever becomes a real problem (multi-GB after several years), we add a compactor that moves old events to compressed files; until then, simpler is correct.

**D4 (locked): Allowed-tools edits apply mid-run.**

The "apply at run start" alternative creates surprising behavior: operator edits an agent to remove `Bash`, expects to see violations stop, but they don't until the next run. The mental model "I changed the agent, the change takes effect" should hold. Implementation cost is small: the PreToolUse handler reads the agent file via `lib/agents.getAgent(slug)` on each call rather than caching at run start. Agent files are a few hundred bytes; this is microseconds. Phase 4's watcher already invalidates cached agent reads on file change, so the live path is already paved.

Side note: this also means the operator can fine-tune policy in real time while watching a run, which is genuinely useful when figuring out what an agent should be allowed to do.

**D5 (locked): Trust `received_at` server timestamp; no payload-timestamp parsing.**

Out-of-order display for rapid events (PostToolUse arriving before its PreToolUse) is a theoretical issue that we'll fix when it actually shows up. The Events tab is presented as a log, not a strict timeline; the UI shows millisecond-precision timestamps so the operator can correlate visually. If two events have identical `received_at` millis (rare), break ties by `id` (insertion order). The "use payload timestamp" alternative requires defensive parsing of fields that vary by Claude Code version and isn't worth the complexity for a problem that may never materialize.

Footnote for future: if this becomes a real pain, the fix is one query change (add a `payload_timestamp` extracted column populated by trigger or by the route handler) and one ORDER BY clause. Reversible.

## Risks

1. **Hook callback flood.** A run with rapid tool calls can fire dozens of hooks per minute. Each is a POST to the dashboard. The dashboard runs Next.js, which handles concurrent requests fine, but the watcher SSE subscribers all get re-rendered for each event. Mitigation: throttle SSE re-broadcasts for hook events to one per second per run; the Events tab re-fetches on a debounce rather than per-event.

2. **Hook script failure breaks the agent.** If the hook script throws (network down, dashboard restarting), Claude Code's hook system shows stderr in the session. The Phase 3 hook script swallows errors and exits 0; Phase 5 should continue this. Risk: dashboard outage means lost events with no error visible. Acceptable; the Events tab doesn't claim guaranteed delivery.

3. **Policy violation false positives.** If the agent uses tool name in a non-canonical case ("bash" vs "Bash") and the allowed-tools list uses the other, every legitimate use looks like a violation. Mitigation: case-insensitive comparison in `lib/policy.ts`.

4. **Transcript snapshot storage growth.** Each PreCompact snapshot can be hundreds of KB. A long-running project might accumulate many. No technical issue (disk is cheap), but operator workflow for cleanup isn't defined. Out of scope per the locked decision; revisit if it actually becomes a problem.

5. **Event payload schemas change between Claude Code versions.** The `payload_json` column stores raw JSON, which absorbs schema changes without breaking the DB. The UI's summary derivation (e.g., "extract tool_name from payload") might break. Mitigation: defensive parsing in `EventRow.tsx` (show "Unknown event" instead of crashing if expected fields are missing).

## Build sub-phases (sketch for the plan)

Likely 10-12 tasks:

1. Generalize hookInstaller to installAllHooks; update hook script for event name arg.
2. Extend the hook callback API route to dispatch on eventName.
3. Data layer for hook_events table (lib/hookEvents.ts).
4. PreCompact transcript snapshot logic.
5. Soft policy enforcement (lib/policy.ts) and integration with PreToolUse handler.
6. SSE re-broadcast throttling for hook events.
7. /api/runs/[id]/events GET endpoint.
8. /api/issues/[id]/events GET endpoint (across all runs).
9. EventsTab UI component (list, rows, payload expand).
10. EventFilterBar UI component.
11. IssueDrawer integration (add Events tab).
12. Phase 5 verification, integration test against a real run.

## References

- Spec 0002 (`specs/0002-path-a-reset.md`): Phase 5 paragraph.
- Phase 3 plan (`docs/plans/2026-05-20-path-a-reset-phase-3.md`): Task 4 (hook installer), Task 6 (callback API), self-review for "hooks beyond SessionStart" deferral.
- Phase 4 spec (`specs/0003-phase-4-agents.md`): the `allowed-tools` frontmatter field this phase enforces against, and the agent edit form whose mid-run edits drive open decision D4.
- LightRAG roadmap (`docs/roadmap/lightrag-mcp.md`): notes Phase 5's hook events as a potential ingestion source for future LightRAG automation (out of scope here, but the event log is a prerequisite).
- Claude Code hooks documentation: hook event names, payload shapes, settings.json structure. Verified during Phase 3 web research.
