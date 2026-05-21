# Path A Reset, Phase 7 Spec: Second Runtime and Runtime Capabilities

> **Status:** Draft. Final phase in the Path A rebuild. Extends spec 0002, Phase 7 paragraph ("ship a second runtime"). Targets implementation after Phase 6 plan lands.

> **Skill basis:** Brainstorming surfaced from the Runtime registry design (Phase 3 Task 3). The registry was always intended to support plural runtimes; Phase 7 stress-tests that and surfaces hidden runtime-specific assumptions elsewhere in the stack. One open decision (D9) queued; rest locked.

## Why this phase exists

The runtime registry built in Phase 3 holds exactly one entry: claude-code. The `Runtime` interface (detect, spawn, formatResumeCommand) was designed for plural runtimes, but until a second one exists, the abstraction is unverified. Worse, several features in later phases quietly assume claude-code semantics: Phase 5's hook events depend on Claude Code's hook protocol, Phase 6's cost parsing assumes Claude Code's jsonl transcript format, Phase 3's "Open in terminal" assumes `claude --resume <sid>`. None of these are explicit dependencies; they're load-bearing assumptions.

Phase 7 introduces the second runtime, stress-tests the boundary, and makes the runtime-specific assumptions explicit by adding a `capabilities` declaration to the Runtime contract. The dashboard UI then honors these capabilities: features that don't apply to a given runtime are hidden or disabled with explanation, not surfaced and broken.

## Goal

After Phase 7:
- A second agent CLI (codex, per D9 below) runs end-to-end inside the dashboard with the same operator workflow as claude-code: file an issue, assign to an agent configured for codex, click Start, watch in xterm, stop or let it finish.
- The Runtime contract has an explicit `capabilities` object that declares what features each runtime supports.
- The dashboard UI honors these capabilities: degraded features show clear placeholder messaging, not broken affordances.
- Adding a third runtime in the future (gemini-cli, antigravity, aider, whatever's emerging in 2027) is a matter of writing a single Runtime implementation file. No changes to other phases' code.

## In scope

1. Add a concrete codex Runtime implementation (D9 below).
2. Extend the Runtime interface with a required `capabilities` object.
3. Spawn flow becomes capability-aware: hook installer skipped if `capabilities.hooks === false`; jsonl session_id watcher skipped if `capabilities.sessionIdCapture === false`.
4. Events tab degrades cleanly: shows a placeholder with explanation when the runtime doesn't emit hooks. Synthetic SessionStart and SessionEnd events come from PTY lifecycle observation so the timeline isn't empty.
5. Cost computation dispatches via `runtime.parseTranscriptUsage(transcriptPath)` if the runtime offers one. Otherwise RunHeader shows "cost N/A (this runtime does not expose usage data)".
6. RunHeader's "Open in terminal" button gates on `capabilities.externalTerminalEscape`.
7. NewAgentDialog and AgentProfileForm (Phase 4) get a runtime dropdown populated from `/api/runtimes`.
8. New `/api/runtimes` GET endpoint returns the list of registered runtimes with their capabilities.
9. RuntimeBadge component appears on agent cards, RunHeader, and the project page when displaying agents.
10. Settings>Pricing absorbs entries for the new runtime's models alongside Claude's.

## Out of scope

- Cross-runtime tool translation. Each runtime is its own thing; we don't pretend codex's tool calls look like claude-code's.
- Migrating runs from one runtime to another mid-session. Past runs keep their `runtime_id`; future runs use whatever the agent is set to now.
- Third+ runtimes. Phase 7 ships ONE second runtime to validate the abstraction; adding more is a copy-paste-modify exercise.
- Anti-corruption layers for runtime-specific quirks beyond what capability flags express.
- Cost normalization across runtimes. Each runtime has its own models; settings pricing has its own entries per model regardless of which runtime uses it.

## Architecture additions

### Runtime capabilities

The Runtime interface from Phase 3 gets a new required field:

```ts
interface RuntimeCapabilities {
  /** Can be re-attached via formatResumeCommand. */
  sessionResume: boolean;
  /** Emits a stable session ID we can capture (via hook OR file watch OR stdout parse). */
  sessionIdCapture: boolean;
  /** Supports Claude Code-style hook events for SessionStart/PreToolUse/etc. */
  hooks: boolean;
  /** Exposes a parseTranscriptUsage() method to support Phase 6 cost computation. */
  transcriptCostParsing: boolean;
  /** Can be opened in an external terminal mid-run via formatResumeCommand. */
  externalTerminalEscape: boolean;
}

interface Runtime {
  // existing from Phase 3
  id: string;
  displayName: string;
  detect(): Promise<RuntimeAvailability>;
  spawn(opts: SpawnOpts): Promise<SpawnedRun>;
  formatResumeCommand(sessionId: string): string;
  
  // new in Phase 7
  capabilities: RuntimeCapabilities;
  parseTranscriptUsage?(transcriptPath: string): TokenUsage;
}
```

claude-code's capabilities, declared in `lib/runtime/claude-code.ts`:

```ts
{
  sessionResume: true,
  sessionIdCapture: true,
  hooks: true,
  transcriptCostParsing: true,
  externalTerminalEscape: true,
}
```

The new runtime declares its own based on what's actually available.

### Capability-aware spawn flow

`spawnClaude` in Phase 3 unconditionally installs the SessionStart hook and starts the jsonl watcher. Phase 7 wraps both behind capability gates so the same generic spawn machinery works for any runtime:

```ts
// Inside the runtime-specific spawn function (not generic; each runtime owns its own spawn):
if (this.capabilities.hooks) {
  installSessionStartHook({ /* ... */ });
}
if (this.capabilities.sessionIdCapture) {
  const sidWatch = watchForSessionId({ /* ... */ });
  sidWatch.promise.then(fireSessionId).catch(() => undefined);
}
```

Each Runtime implementation is responsible for its own spawn flow. The capability flags exist for the dashboard UI to consult, not as a generic spawn polyfill.

### Capability-aware UI

A new `useRuntime(id)` hook returns the registered Runtime including capabilities. Components consume it:

```tsx
const runtime = useRuntime(run.runtimeId);

{runtime?.capabilities.externalTerminalEscape && (
  <OpenInTerminalButton runId={run.id} />
)}

{runtime?.capabilities.hooks ? (
  <EventsTab issueId={issue.id} />
) : (
  <EventsTabPlaceholder runtimeName={runtime?.displayName} />
)}
```

`EventsTabPlaceholder` shows a friendly explanation: "This runtime does not emit hook events. Lifecycle events (session start, session end) are recorded from PTY observation but tool calls and prompts are not visible from outside the session."

Cost chip degradation in RunHeader:

```tsx
{runtime?.capabilities.transcriptCostParsing ? (
  <CostChip runId={run.id} />
) : (
  <span title="Cost calculation not available for this runtime">
    cost N/A
  </span>
)}
```

### Synthetic lifecycle events

For runtimes without hook support, the dashboard synthesizes two events from PTY lifecycle observation:
- `SessionStart` when `runtime.spawn` returns (the PTY is alive).
- `SessionEnd` when the PTY exits.

These get persisted to `hook_events` with `hook_event_name = "SessionStart"` (or End) and `payload_json` set to a synthetic minimal payload. A new column `is_synthetic` (BOOLEAN, default 0) marks them. The Events tab labels synthetic events with "(synthetic)" so the operator knows they came from observation, not the CLI itself.

This is the one place we polyfill across capability boundaries. Rationale: an empty Events tab when a session demonstrably ran is more confusing than two synthetic lifecycle markers with a clear "(synthetic)" tag.

### Cost computation per-runtime

`lib/usage.ts` `recomputeRunUsage(runId)` becomes capability-aware:

```ts
function recomputeRunUsage(runId: number) {
  const run = getRun(runId);
  if (!run) return;
  const runtime = getRuntime(run.runtimeId);
  if (!runtime?.parseTranscriptUsage) {
    upsertRunUsage(runId, ZERO_USAGE, 0, { pricingKnown: false, parserAvailable: false });
    return;
  }
  if (!run.transcriptPath) {
    upsertRunUsage(runId, ZERO_USAGE, 0, { pricingKnown: false, parserAvailable: true });
    return;
  }
  const usage = runtime.parseTranscriptUsage(run.transcriptPath);
  // ... compute cost via settings pricing ... upsert
}
```

`run_usage` table gets a new column `parser_available` (BOOLEAN, default 1) so the UI can distinguish "no parser" from "parser exists but no transcript yet."

### Settings pricing absorbs new runtime's models

The pricing table from Phase 6 keys on model name (e.g., `claude-sonnet-4-6`). Adding codex means adding entries for the OpenAI models codex uses (e.g., `gpt-5-codex`, `gpt-5-codex-mini`, whatever codex exposes as of plan-writing). No structural change to the pricing schema; just more rows. The seed script extends to include codex's current models at install time.

Pricing entries follow the same shape as Claude's (input/output/cache-creation/cache-read per 1M tokens). OpenAI's pricing model is structurally similar to Anthropic's for the major axes, so the existing schema absorbs without modification.

### Agent runtime selection

Phase 4's NewAgentDialog and AgentProfileForm get a runtime dropdown sourced from `/api/runtimes`. Default selection follows `settings.runtime.default` (currently `claude-code`). Existing agents with `runtime: claude-code` keep working; new agents can pick the second runtime.

Project's `runtime-default:` frontmatter (from spec 0002) remains the fallback when an agent's frontmatter doesn't specify a runtime.

### RuntimeBadge component

A small pill displayed wherever an agent or run is shown: agent cards on the Agents page, agent profile header, RunHeader inside the issue drawer, crew sidebar on the project page. The badge shows the runtime's displayName with a runtime-specific color (each runtime declares a color in its definition, defaulting to a hash of the id).

## Schema changes

Two additive columns:

```sql
ALTER TABLE hook_events ADD COLUMN is_synthetic INTEGER NOT NULL DEFAULT 0;
ALTER TABLE run_usage ADD COLUMN parser_available INTEGER NOT NULL DEFAULT 1;
```

Both are safe additions; existing rows take the default. No data migration needed.

## New files

```
dashboard/
  lib/
    runtime/
      codex.ts                               # NEW: concrete Runtime impl (D9 = codex)
      capabilities.ts                        # NEW: type defs and helpers
      claude-code.ts                         # MODIFY: declare capabilities object
      types.ts                               # MODIFY: extend Runtime interface
  app/
    api/
      runtimes/route.ts                      # NEW: GET list with capabilities
  components/
    common/
      RuntimeBadge.tsx                       # NEW
    issue/
      RunsTab.tsx                            # MODIFY: capability gates
      RunHeader.tsx                          # MODIFY: capability gates
      EventsTab.tsx                          # MODIFY: capability-aware
      EventsTabPlaceholder.tsx               # NEW
      OpenInTerminalButton.tsx               # MODIFY: capability gate
      CostChip.tsx                           # MODIFY: capability gate
    agents/
      AgentProfileForm.tsx                   # MODIFY: runtime dropdown
      NewAgentDialog.tsx                     # MODIFY: runtime dropdown
      AgentCard.tsx                          # MODIFY: show RuntimeBadge
  hooks/
    useRuntime.ts                            # NEW
    useRuntimes.ts                           # NEW
  tests/
    capabilities.test.ts
    codex.test.ts
    synthetic-events.test.ts
```

## Acceptance criteria

F-series for Phase 7.

**F1.** `GET /api/runtimes` returns a JSON array with at least two entries: claude-code and the second runtime. Each entry has id, displayName, color, capabilities (all five booleans).

**F2.** NewAgentDialog runtime dropdown lists both runtimes. Default selected matches `settings.runtime.default`.

**F3.** Create an agent configured with the second runtime. Save. The Agents page shows the new agent with the second runtime's RuntimeBadge.

**F4.** Add this agent to a project's crew. File an issue, assign to this agent, click Start.

**F5.** The second runtime spawns in the worktree. xterm shows its output. Keystrokes round-trip into the spawned CLI.

**F6.** If `capabilities.sessionIdCapture === true`, session_id appears in RunHeader within ~5s. If false, RunHeader shows "session id: not supported by this runtime" instead.

**F7.** If `capabilities.hooks === true`, the Events tab populates with real hook events. If false, the Events tab shows the placeholder explaining the limitation, plus synthetic SessionStart and SessionEnd events labeled "(synthetic)".

**F8.** If `capabilities.externalTerminalEscape === true`, the "Open in terminal" button is enabled when session_id is captured. If false, the button is hidden entirely.

**F9.** If `capabilities.transcriptCostParsing === true`, RunHeader cost chip populates after SessionEnd. If false, RunHeader shows "cost N/A" with tooltip explanation.

**F10.** Mixed-runtime crew: a project has one claude-code agent and one second-runtime agent. Both agents can be assigned to issues in the same project. Their runs attribute correctly to their respective runtimes throughout the dashboard.

**F11.** Settings>Pricing accepts new entries for the second runtime's models. After adding a model and clicking Refresh costs, the costs for completed runs against that model populate correctly.

**F12.** Synthetic events (when `capabilities.hooks === false`) include `is_synthetic: 1` in their `hook_events` row. The Events tab renders them with a "(synthetic)" suffix on the event name.

**F13.** Stale or unknown runtime ID (e.g., a run record references a runtime that was removed from the registry). The dashboard renders the agent/run without crashing; RuntimeBadge shows "unknown runtime" with the stored id; capability-gated features all default to off.

## Verification scenarios

The phase-level walkthrough:

1. Create two agents: one on claude-code, one on the second runtime. Both have the same skills.
2. Add both to the same project's crew.
3. File two issues against this project. Assign one to each agent. Run both.
4. Watch the dashboard: each issue's drawer shows its agent's RuntimeBadge, capability-gated features (Events tab, cost chip, "Open in terminal" button) reflect each runtime's capabilities.
5. Both runs end. Cost is shown per the runtime's parser availability.
6. Settings>Costs shows both runtimes' spend in the per-project breakdown.
7. Go to the second runtime's agent profile. Edit it to switch runtime back to claude-code. Save. Future runs use claude-code. Past runs in the agent's history still show the original runtime in their RunHeader.

If all this works, the abstraction is sound and Phase 7 (and the Path A reset overall) is done.

## Locked decisions (May 2026)

Two batches: seven foundational from initial design, one operator-confirmed (D9).

### First batch: foundational design

**Runtimes declare capabilities explicitly.** Each Runtime implementation defines its own capabilities object as a static declaration. Alternative considered: dynamic capability discovery (probe at startup whether hooks fire, whether transcripts exist). Rejected because it adds complexity for negligible benefit and creates hard-to-debug environmental sensitivity.

**Capability-aware UI degrades, doesn't polyfill (with one exception).** When a runtime lacks a feature, the UI shows a clear placeholder rather than faking it. Exception: synthetic SessionStart and SessionEnd events for runtimes without hooks, because the alternative (empty Events tab when a session demonstrably ran) is more confusing than two clearly-labeled synthetic markers.

**Mixed-runtime crews allowed without warnings.** A project can have agents on different runtimes. The dashboard doesn't enforce uniformity. The operator picked the runtime per agent; that's authoritative. If consistency matters, the operator enforces it themselves.

**One second runtime, not multiple.** Phase 7 ships exactly ONE additional runtime to validate the abstraction. Adding more after is a copy-paste-modify exercise once the pattern is proven. Shipping two or three new runtimes at once would obscure what the pattern actually requires.

**No agent runtime migration.** Changing an agent's runtime affects future runs only. Past runs keep their original `runtime_id` because that's a historical record of what actually happened, not state.

**API keys and runtime credentials live in environment variables, not settings.** If the new runtime requires an API key (likely for non-Anthropic runtimes), the operator sets it as an env var. The dashboard doesn't store or manage credentials. Rationale: settings file lives in vault, which is sometimes synced or backed up; credentials should never end up there.

**Runtime selection in agent forms is a dropdown of registered runtimes, not free-text.** A free-text input would let the operator type an unregistered runtime id, which would fail silently at run time. The dropdown prevents this class of error.

### Second batch: operator-confirmed (D9)

**D9 (locked): codex (OpenAI's coding CLI) is the second runtime.**

Picked from four candidates (codex, gemini-cli, aider, antigravity). The reasoning preserved here so the choice is auditable:

1. Closest paradigm to claude-code. Codex runs as an interactive CLI with TUI rendering inside a PTY, which means the spawn/xterm/PTY model from Phase 3 translates cleanly without architectural rework. Lower implementation risk than aider (file-diff paradigm requires different UI mental model) or antigravity (unknown maturity).

2. Well-maintained by a vendor that invests heavily. OpenAI ships frequent updates to codex through 2026; the CLI is unlikely to bit-rot during the implementation window.

3. Stress-tests the abstraction on a non-Anthropic CLI. If we accidentally hardcoded claude-code assumptions (Claude-specific hook protocol, jsonl transcript schema, `--resume <sid>` flag syntax), codex will surface them. Gemini-cli would also stress-test these but the abstraction work would be very similar; codex's higher real-world usage makes it the more useful proof point.

4. Real operational value. If Claude is rate-limited or context-exhausted, having codex as a backup for the same issue is genuinely useful, not just a demo. Both vendors are competitive on coding agent capability as of May 2026; this is operationally meaningful redundancy.

Codex's concrete capabilities will be verified at plan-writing time via the same web-research pattern used in Phase 3 (verifying Claude Code CLI behavior). Assumed for now based on May 2026 publicly-known behavior:

```ts
{
  sessionResume: true,       // codex supports session resume (verify exact flag at plan time)
  sessionIdCapture: true,    // assumed; verify mechanism (file watch vs stdout parse vs hooks)
  hooks: false,              // codex does not implement Claude Code-style hooks
  transcriptCostParsing: true,  // codex writes a session log; format to be parsed
  externalTerminalEscape: true, // assumed via resume command
}
```

If `hooks: false` holds at plan time, codex agents will get synthetic SessionStart/SessionEnd events but no PreToolUse/PostToolUse/UserPromptSubmit timeline. Acceptable degradation per the locked policy ("UI degrades, doesn't polyfill, with synthetic lifecycle as the one exception").

If any other assumption flips at plan time (e.g., codex turns out to not expose a parsable transcript), the corresponding capability flag goes to `false` and the UI degrades. The architecture absorbs this without spec changes.

## Risks

1. **Runtime version drift.** Each runtime evolves on its own schedule. A capability flag can become stale if the runtime adds a feature we don't update for. Mitigation: capability flags are checked at runtime via the registry, not cached anywhere; updating one is a one-line change in the runtime's source file.

2. **Transcript format ambiguity.** Cost parsing for the new runtime requires understanding its log format. If the new runtime doesn't expose usage data or uses a wildly different schema, `transcriptCostParsing` is `false` and Phase 6 cost features simply don't show. Acceptable degradation.

3. **CLI install detection.** `detect()` relies on the binary being on PATH. Some runtimes install to non-standard locations (Homebrew's keg-only formulas, npm globals on weird paths). Mitigation: settings can include an optional `binaries.<runtime-id>` override path that the runtime's `detect()` checks first.

4. **Mixed-runtime confusion.** An operator with agents on multiple runtimes might be surprised that their UI features differ. Mitigation: RuntimeBadge on every agent card and RunHeader makes the runtime visible at all times. The operator consciously opted in by configuring agents per-runtime.

5. **Resume command divergence.** Each runtime's "open in terminal" command differs. claude-code uses `claude --resume <sid>`. codex might use `codex resume <sid>` or `codex --session <sid>`. `formatResumeCommand` handles this per-runtime; the abstraction works as long as some command exists. If a runtime needs additional context (working directory, env vars) beyond what `openExternalTerminal` already passes, the runtime can return a more complex shell snippet.

6. **API key leakage if operator stores in settings.json.** The locked decision routes credentials through env vars, but an operator might paste an API key into settings.json anyway. Mitigation: documented in the Runtime implementation's README; settings JSON validator emits a warning if it sees fields named like keys.

7. **Two runtimes ≠ proven for N runtimes.** Phase 7 validates the contract on a sample size of 2. Some abstractions look right at N=2 and break at N=3. Mitigation: when a third runtime is added later, that integration is itself a stress test. If the abstraction breaks, refactor and add tests; we're not promised first-time-right.

## Build sub-phases (sketch for the plan)

Likely 10-12 tasks:

1. Capability type definitions and Runtime interface extension.
2. claude-code runtime declares capabilities (no behavior change, just declaration).
3. `/api/runtimes` GET endpoint with capabilities serialization.
4. `useRuntime` and `useRuntimes` hooks.
5. RuntimeBadge component with hash-based color generation.
6. New runtime implementation: detect, spawn, formatResumeCommand.
7. New runtime: parseTranscriptUsage if transcriptCostParsing supported, otherwise omitted.
8. Capability gates in RunsTab, RunHeader, EventsTab, OpenInTerminalButton, CostChip.
9. Synthetic event injection on PTY lifecycle for runtimes without hooks.
10. Agent forms (NewAgentDialog, AgentProfileForm) runtime dropdown.
11. Settings pricing entries for new runtime's models in seed script.
12. Phase 7 verification end-to-end with both runtimes.

## References

- Spec 0002 (`specs/0002-path-a-reset.md`): Phase 7 paragraph; Runtime interface as originally specified.
- Phase 3 plan (`docs/plans/2026-05-20-path-a-reset-phase-3.md`): Task 3 (Runtime registry), Task 4 (claude-code implementation). The pattern Phase 7 generalizes.
- Phase 4 spec (`specs/0003-phase-4-agents.md`): agent edit form gets the runtime dropdown.
- Phase 5 spec (`specs/0004-phase-5-hooks.md`): hook-related features become capability-gated; synthetic event injection is the polyfill exception.
- Phase 6 spec (`specs/0005-phase-6-settings-costs.md`): cost computation dispatches per runtime; settings pricing absorbs new runtime's models without structural change.
