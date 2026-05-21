# Path A Reset, Phase 6 Spec: Settings UI and Cost Visibility

> **Status:** Draft. Extends spec 0002, Phase 6 paragraph ("Settings + caps + cost visibility"). Targets implementation after Phase 5 plan lands.

> **Skill basis:** Brainstorming surfaced from Phase 3 (concurrency caps hardcoded), Phase 4 (worktree cleanup UX), and Phase 5 (hooks provide rich data, including the transcript_path needed for cost). Three open decisions queued via `ask_user_input_v0`; rest locked here with rationale.

## Why this phase exists

Settings live in code today. Per-project concurrency cap is hardcoded to 3, global to 5, `PROMPT_READY_DELAY_MS` to 1200. The Settings page Phase 1 added is a stub that displays values without letting you change them. Every operational tweak (raise the cap when you've got more headroom, lower the prompt-ready delay when your machine is fast) requires editing `lib/settings.ts` and restarting the server.

Cost visibility is entirely absent. Every run burns tokens that map to real dollars. The operator has no idea how much yesterday's QML lit review cost versus the BPL communications drafting. The `ccusage` community CLI tool exists, but it lives outside the dashboard, doesn't attribute by project, agent, or issue, and doesn't surface where runs actually happen.

Phase 6 fixes both: settings become file-backed JSON the operator can edit through a real UI (or directly in Obsidian if they prefer), and cost shows up at every level (run, issue, project, global) with attribution that matches how runs are actually organized.

## Goal

After Phase 6:

- Every dashboard config that affects behavior is editable from the Settings page. No code changes required for any tuning.
- Every run displays its cost in the RunHeader. Every issue shows total cost across runs. Every project shows month-to-date cost. The Settings>Costs section shows global totals with project and agent breakdowns.
- Pricing for each model is configurable so when Anthropic changes prices (which they will), no code change is needed.

## In scope

1. Settings page UI with five editable sections: Workspace, Concurrency, Runtime, Pricing, Costs.
2. Settings storage migrated from hardcoded `lib/settings.ts` to a JSON file at `vault/.agentic-os/settings.json`.
3. Watcher (already running from Phase 1) reloads settings when the file changes; SSE event `settings.changed` re-fetches UI.
4. Cost data layer: parse Claude Code's transcript jsonl files at SessionEnd, extract per-message token usage, compute cost via configurable pricing table.
5. New `run_usage` table caching parsed usage per run.
6. Cost computation triggered on the Phase 5 SessionEnd hook and on a manual "Refresh costs" button.
7. RunHeader displays per-run cost as a chip alongside status.
8. IssueHeader (the metadata strip in the issue drawer) displays issue-total cost across runs.
9. ProjectPage displays a month-to-date project cost card near the kanban header.
10. Settings>Costs section shows global month-to-date with per-project and per-agent breakdowns.

## Out of scope

- Budget alerts ("warn when project exceeds $X"). Needs a notification surface area (browser notifications, email, in-dashboard banners) that doesn't exist yet. Cost visibility is the prerequisite; alerts come later if useful.
- Multi-currency display. USD only. Operators in other regions mentally convert.
- Anthropic Usage API integration. The jsonl files are local and sufficient. The API requires an Anthropic API key that the operator may not have separate from their Claude Code subscription.
- Cost forecasting or projections.
- Per-tool-call cost breakdown. Possible by analyzing PostToolUse events with cache hit info, but complex. Defer unless asked.
- Cost data export (CSV download). The DB is local and queryable directly if the operator wants offline analysis.
- Settings versioning or change history.

## Architecture additions

### Settings storage

`lib/settings.ts` from Phase 1 currently hardcodes values and exposes `getSettings()`. Phase 6 redirects the source of truth to `vault/.agentic-os/settings.json`. The file is read at boot and on every settings access (cheap, file is under a few KB). Missing keys fall back to defaults. Malformed JSON falls back to defaults plus a Settings page banner showing the parse error.

Schema (loose, additive):

```json
{
  "workspaceRoot": "/Users/tj/code",
  "concurrency": {
    "perProjectMax": 3,
    "globalMax": 5
  },
  "runtime": {
    "default": "claude-code",
    "promptReadyDelayMs": 1200
  },
  "pricing": {
    "updatedAt": "2026-05-21",
    "models": {
      "claude-haiku-4-5": {
        "inputPer1MTokens": 1.00,
        "outputPer1MTokens": 5.00,
        "cacheCreationPer1MTokens": 1.25,
        "cacheReadPer1MTokens": 0.10
      },
      "claude-sonnet-4-6": {
        "inputPer1MTokens": 3.00,
        "outputPer1MTokens": 15.00,
        "cacheCreationPer1MTokens": 3.75,
        "cacheReadPer1MTokens": 0.30
      },
      "claude-opus-4-7": {
        "inputPer1MTokens": 5.00,
        "outputPer1MTokens": 25.00,
        "cacheCreationPer1MTokens": 6.25,
        "cacheReadPer1MTokens": 0.50
      }
    }
  }
}
```

New `updateSettings(patch)` function writes back to the file. Chokidar watcher (already running from Phase 1) sees the change and fires the SSE `settings.changed` event. UI components consuming settings via `useSettings()` hook re-fetch.

### Settings page UI

Currently a stub. Phase 6 replaces with five sections rendered as cards:

1. **Workspace**: workspace root path (text input, validated as existing directory at save time).
2. **Concurrency**: per-project max (1-20), global max (1-50). Both inline number inputs in a modal.
3. **Runtime**: default runtime (select from registered runtimes via `/api/runtimes`), prompt-ready delay (number 200-5000 ms).
4. **Pricing**: model name + the four per-1M-token rates. Rendered as a table with Add/Edit/Remove actions. Each row is a model.
5. **Costs**: month-to-date global total, breakdowns by project and by agent, "Refresh costs" button, date-range selector (current month, last 7 days, last 30 days, all time). Read-only display; this is a dashboard, not an editor.

Each editable section has an "Edit" button that opens a modal scoped to that section. Save writes the patch via `PUT /api/settings`.

### Cost data layer

A new `lib/usage.ts` module:

```ts
parseTranscriptUsage(transcriptPath: string): TokenUsage
computeCost(usage: TokenUsage, modelPricing: ModelPricing): number  // returns cents (integer)
recomputeRunUsage(runId: number): void                              // parse, cost, upsert
getRunUsage(runId: number): RunUsage | null
sumUsageForIssue(issueId: number): RunUsageAggregate
sumUsageForProject(slug: string, since?: number): RunUsageAggregate
sumUsageGlobal(since?: number): GlobalUsageBreakdown
```

`parseTranscriptUsage` reads the jsonl line by line. Each line is a JSON object; assistant messages have a `message.usage` field with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`. Sum across all assistant turns. Also extract the `model` field from message metadata (e.g., `claude-sonnet-4-6-20250514`).

`computeCost` looks up the model in the settings pricing table. If unknown, returns 0 and the caller is expected to flag this in the UI (RunHeader shows "pricing unknown" with the token counts). Computation:

```
cost_dollars = (
  input_tokens * model.inputPer1MTokens / 1_000_000 +
  output_tokens * model.outputPer1MTokens / 1_000_000 +
  cache_creation_input_tokens * model.cacheCreationPer1MTokens / 1_000_000 +
  cache_read_input_tokens * model.cacheReadPer1MTokens / 1_000_000
)
cost_cents = round(cost_dollars * 100)
```

Cents stored as INTEGER to avoid floating-point drift in aggregations.

### Triggering cost computation

Two paths:

1. **Automatic on SessionEnd**: Phase 5's SessionEnd handler in `/api/runs/[id]/hook/route.ts` calls `recomputeRunUsage(runId)` after persisting the event. Quick path; parses the transcript and inserts into `run_usage`. Failure logs to stderr but doesn't fail the hook callback (the dashboard still wants to record SessionEnd).

2. **Manual refresh**: A "Refresh costs" button in Settings>Costs and on each RunHeader. Iterates the chosen scope (all runs, single run) and recomputes. The recompute uses cached token counts in `run_usage` if available (avoids re-parsing the jsonl); only fetches fresh from jsonl if `run_usage` is missing or stale (e.g., if `computed_at < transcript_mtime`).

PreCompact snapshots from Phase 5 are NOT re-parsed for cost. The live transcript at SessionEnd contains the complete conversation including everything that survived compaction. Snapshots exist for historical record, not cost computation.

### Cost UI surfaces

Four places:

1. **RunHeader** (Phase 3 component): adds a cost chip alongside the status pill and session_id display. Format: `$0.23 · 12k in · 4k out`. While computation is in flight, shows `· computing…`. If model pricing unknown, shows `$? · 12k in · 4k out` with a tooltip explaining.

2. **IssueHeader** (Phase 2 component, in the issue drawer): adds a line below the metadata strip. `Total cost: $1.84 across 3 runs`. Sum of `run_usage.cost_usd_cents` for runs on this issue.

3. **ProjectPage** (Phase 2): new `ProjectMonthlyCostCard` placed in the project page header row. Shows `This month: $47.32 across 28 runs`. Click expands a small sparkline of per-day spend.

4. **Settings>Costs section**: full breakdown. Global total at top. Two tables below: per-project (sorted by spend desc) and per-agent (sorted by spend desc). Date range selector at top of section.

### Pricing model

Pricing lives in `settings.json` as shown in the storage section. Each model has four per-1M-token rates: input, output, cache creation, cache read. The model name from the transcript jsonl (e.g., `claude-sonnet-4-6-20250514`) must match a key in the pricing table for cost computation to succeed.

Default pricing seeded at install per locked decision D8: Haiku 4.5, Sonnet 4.6, Opus 4.7 at their May 21, 2026 prices verified during spec authoring. Operator edits when Anthropic announces changes. Top-level `pricing.updatedAt` field tracks recency; staleness banner appears in Settings>Pricing if older than 90 days.

Versioned model names (e.g., `claude-sonnet-4-6-20250514` vs `claude-sonnet-4-6-20251024`) collapse to the same base key (`claude-sonnet-4-6`) via a simple prefix match. The pricing table holds base keys; the lookup strips the date suffix.

## Schema changes

New table:

```sql
CREATE TABLE run_usage (
  run_id INTEGER PRIMARY KEY,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd_cents INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  pricing_known INTEGER NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_run_usage_computed_at ON run_usage(computed_at);
```

`pricing_known` is a boolean flag (0 or 1). When pricing is added for a previously-unknown model and Refresh runs, this updates from 0 to 1.

## New files

```
dashboard/
  app/
    settings/page.tsx                              # REPLACE: real settings page
    api/
      settings/route.ts                            # MODIFY: GET works from Phase 3; add PUT
      usage/
        run/[id]/route.ts                          # NEW: GET single-run; POST refresh
        issue/[id]/route.ts                        # NEW: GET issue total
        project/[slug]/route.ts                    # NEW: GET project rollup
        global/route.ts                            # NEW: GET global breakdown
      runtimes/route.ts                            # NEW: list registered runtimes for runtime-default select
  components/
    settings/
      WorkspaceSection.tsx
      ConcurrencySection.tsx
      RuntimeSection.tsx
      PricingSection.tsx
      PricingTable.tsx
      CostsSection.tsx
      CostsBreakdownTable.tsx
      EditSectionModal.tsx
    common/
      CostChip.tsx                                 # used in RunHeader and IssueHeader
    issue/
      RunHeader.tsx                                # MODIFY: add CostChip
      IssueDrawer.tsx                              # MODIFY: add issue-total line
    project/
      ProjectMonthlyCostCard.tsx                   # NEW
  hooks/
    useSettings.ts                                 # NEW: read + watch
    useRunUsage.ts                                 # NEW: per-run usage with refresh
  lib/
    usage.ts                                       # NEW: parser + cost computer + queries
    pricing.ts                                     # NEW: pricing lookup with prefix collapse
    settings.ts                                    # MODIFY: file-backed, add updateSettings
  scripts/
    seed-default-pricing.ts                        # NEW: one-time on first boot
  tests/
    usage.test.ts
    pricing.test.ts
    settings-update.test.ts
```

## Acceptance criteria

E-series for Phase 6.

**E1.** Settings page loads. Five section cards visible: Workspace, Concurrency, Runtime, Pricing, Costs. Each section's current values are displayed.

**E2.** Click Edit on Concurrency. Modal opens with per-project max and global max inputs. Change per-project to 5. Save. Modal closes. Open `vault/.agentic-os/settings.json` directly; the file shows the new value. Try to start a 4th concurrent run on one project; it should succeed where before it would have been blocked.

**E3.** Edit `vault/.agentic-os/settings.json` directly in Obsidian; change global max to 10. The Settings page reflects the new value within ~1s via watcher SSE.

**E4.** Click Edit on Pricing. Modal shows the current model pricing table. Add a new model "claude-haiku-4-5" with custom prices. Save. The pricing table updates immediately.

**E5.** Run an issue end-to-end. After SessionEnd fires, RunHeader updates to show a cost chip like `$0.18 · 8k in · 2k out`. Cross-check: run `npx ccusage` (or equivalent) against the same transcript file; the dashboard's input and output token counts match.

**E6.** Open an issue with 3 completed runs. IssueHeader shows `Total cost: $1.04 across 3 runs`. The sum equals the three individual RunHeader cost values.

**E7.** Open a project page (the QML project preferred for dogfood). ProjectMonthlyCostCard shows current month-to-date spend in dollars and run count.

**E8.** Click into the ProjectMonthlyCostCard. A small sparkline of per-day spend shows for the current month.

**E9.** Open Settings>Costs. Card shows global month-to-date. Two breakdown tables below show per-project (sorted by spend) and per-agent (sorted by spend). The sums match the global total.

**E10.** Change a model price in Settings>Pricing. Click "Refresh costs" in Settings>Costs. The aggregate displayed costs update without re-parsing transcripts (token counts cached in `run_usage` stay the same; only the cost recomputation runs).

**E11.** A run completes for a model not in the pricing table. RunHeader cost chip shows `$? · 12k in · 4k out` with a tooltip "Add pricing for `<model-name>` in Settings > Pricing". `pricing_known` is 0 in the DB. Add the model to Pricing and click Refresh costs; the chip updates with the actual cost and `pricing_known` flips to 1.

**E12.** Stale `settings.json` (missing keys, malformed JSON) does not crash the dashboard. Defaults are used. The Settings page shows a banner: "settings.json has errors; using defaults" with the parse error message inline.

**E13.** Cost recompute is idempotent. Running "Refresh costs" twice in a row produces identical results.

## Verification scenarios

Phase-level walkthrough:

1. Edit concurrency cap from the Settings page. Verify both the file and the Start button tooltip behavior reflect it (E2).
2. Run a fresh issue end-to-end. Wait for SessionEnd. Verify cost appears in RunHeader; cross-check against `npx ccusage` (E5).
3. Open the IssueHeader on an issue with multiple runs. Verify total cost (E6). Run another issue on the same project. Verify ProjectMonthlyCostCard updates (E7).
4. Go to Settings>Costs. Verify per-project breakdown matches per-project numbers from individual project pages (E9).
5. Edit a price in Settings>Pricing. Refresh costs. Verify aggregate costs update everywhere (E10).
6. Run a brand-new model. Cost chip shows "$?". Add pricing. Refresh. Cost appears (E11).

If all six work, Phase 6 is done.

## Locked decisions (May 2026)

Two batches: the first seven foundational, the last three (D6, D7, D8) confirmed by the operator.

### First batch: foundational design

**Cost data source: parse jsonl transcript files.** Three alternatives considered: ccusage as a dependency, Anthropic Usage API, or transcript parsing. The jsonl files are already on disk, already pointed at by `runs.transcript_path`, and the format is well-documented and stable across Claude Code versions. No external dependencies, no API key, no network, exact per-run attribution.

**Cents storage, not floats.** Floats drift in cumulative sums. Cents as INTEGER is safer and matches financial systems conventions. Display logic converts back to dollars (`$X.YY`).

**Cost computed on SessionEnd and cached in `run_usage`.** Parsing transcript jsonl on every page load would be slow. Cache keyed on `run_id` since each run has exactly one transcript. When pricing changes, recompute by replaying cached token counts against new prices; no transcript re-read needed.

**Settings as JSON file in vault, watched live.** Operator already uses Obsidian to edit other vault files. A JSON file at `vault/.agentic-os/settings.json` is editable both via the UI and by hand. File is small (under a few KB even with pricing for many models); read-on-access is fine.

**USD only.** Currency conversion is a real product feature with corner cases. Out of scope; mentally convert if needed.

**No budget alerts.** Needs a notification surface that doesn't exist. Visibility is the prerequisite; alerts come later if they prove necessary.

**Versioned model names collapse to base keys.** `claude-sonnet-4-6-20251024` and `claude-sonnet-4-6-20251119` both look up `claude-sonnet-4-6` in the pricing table. Prefix match strips the date suffix. Simpler than maintaining a row per release; Anthropic's pricing is per-model-family, not per-snapshot.

### Second batch: operator-confirmed (D6, D7, D8)

**D6 (locked): Pricing display unit is per 1M tokens.**

The operator's source of truth is Anthropic's pricing page, which publishes per-million rates. Matching that unit removes the mental conversion step every time pricing gets edited. Smaller numbers (3.00 instead of 3000) are a minor cosmetic plus. The Pricing edit modal labels each field "per 1M tokens" explicitly so the unit is never ambiguous.

**D7 (locked): Cost calculation uses the final SessionEnd transcript only; PreCompact snapshots are not consulted.**

Claude Code's jsonl transcript is append-only and persistent across compactions. Pre-compact turns remain in the file with their original `message.usage` records intact; compaction summarizes the in-context representation, not the on-disk history. The final transcript at SessionEnd therefore contains the complete billable usage record. Snapshots exist for narrative reconstruction (what was in the conversation before compaction summarized it away), not for cost recovery.

If this assumption turns out to be wrong in practice (some Claude Code version truncates pre-compact entries in the jsonl), the fix is small: extend `recomputeRunUsage` to also parse the most recent PreCompact snapshot and use whichever total is higher. Reversible.

**D8 (locked): Hardcode current Anthropic prices at install with a `pricingUpdatedAt` date stamp and a staleness banner after 90 days.**

The first-boot experience needs sensible defaults so the operator immediately sees real cost numbers (confirms the integration is wired correctly without any setup ceremony). The seed script writes pricing for the three current Anthropic models verified May 21, 2026:

```
claude-haiku-4-5:  $1.00 / $5.00  / $1.25 / $0.10  (input/output/cache-write/cache-read per 1M)
claude-sonnet-4-6: $3.00 / $15.00 / $3.75 / $0.30
claude-opus-4-7:   $5.00 / $25.00 / $6.25 / $0.50
```

Cache write rate is 1.25x input (5-minute cache duration, the common case for agent flows). Cache read rate is 10% of input. Both factors are stable Anthropic conventions that have held across multiple model generations.

Settings file includes a top-level `pricing.updatedAt` field set to the seed date. The Settings>Pricing section displays the date next to each model. If any model's effective pricing is older than 90 days (no edit since), a banner suggests checking Anthropic's pricing page for changes. The 90-day threshold is conservative; Anthropic's price changes are infrequent.

## Risks

1. **Anthropic price changes lag.** If Anthropic changes prices and the operator doesn't update Settings>Pricing, costs displayed are wrong. Mitigation: show a "last updated YYYY-MM-DD" timestamp next to each model in Pricing; banner on Settings page if any model has pricing older than 90 days.

2. **Transcript format changes.** Claude Code's jsonl format could change between releases in a way that breaks `parseTranscriptUsage`. Mitigation: defensive parsing (skip lines that don't have expected fields), log warnings for unparseable lines, fall back to "$?" display rather than crashing.

3. **Large transcript files.** A long-running session can produce a transcript jsonl in the tens of MB. Parsing is line-by-line so memory is fine, but the first parse can take a couple of seconds. Mitigation: do this asynchronously after SessionEnd (don't block the hook callback), show a loading state in the UI.

4. **Cache staleness.** If the operator manually re-runs a Claude Code session (using the same session_id) outside the dashboard, the transcript grows but `run_usage` doesn't update. Mitigation: the manual "Refresh costs" button on RunHeader re-parses; the `computed_at < transcript_mtime` check makes Refresh All automatically pick up changes.

5. **Settings file deletion or corruption.** Operator could `rm` the settings file. Mitigation: defaults always work; settings file recreated on next write. No data loss because the file IS the storage.

6. **Concurrency cap change mid-run conflicts.** If operator raises the cap mid-run, the new runs can start. If they lower it below current active runs, active runs continue (no force-kill) but the new cap blocks fresh starts until the active count drops. Acceptable behavior; document in the modal.

## Build sub-phases (sketch for the plan)

Likely 12-14 tasks:

1. Settings file storage: `lib/settings.ts` refactor to file-backed; tests.
2. `PUT /api/settings` endpoint.
3. Watcher integration for settings.json; SSE event.
4. Settings page real version with section cards.
5. EditSectionModal generic component.
6. WorkspaceSection, ConcurrencySection, RuntimeSection edit flows.
7. PricingTable + PricingSection edit flow.
8. `lib/usage.ts` parser and computer; tests.
9. `lib/pricing.ts` model name collapse; tests.
10. `run_usage` table migration; data layer.
11. SessionEnd hook handler calls recomputeRunUsage.
12. `/api/usage/*` endpoints (run, issue, project, global).
13. CostChip component; RunHeader and IssueHeader integration.
14. ProjectMonthlyCostCard.
15. CostsSection in Settings with breakdown tables and Refresh button.
16. Phase 6 verification, dogfood against the QML project's accumulated runs.

## References

- Spec 0002 (`specs/0002-path-a-reset.md`): Phase 6 paragraph.
- Phase 3 plan (`docs/plans/2026-05-20-path-a-reset-phase-3.md`): concurrency cap location, RunHeader component, `runs.transcript_path` column populated.
- Phase 4 spec (`specs/0003-phase-4-agents.md`): agent edit form whose live-read pattern (D4 in Phase 5) parallels settings live-read here.
- Phase 5 spec (`specs/0004-phase-5-hooks.md`): SessionEnd hook handler that triggers cost computation; PreCompact snapshots that this phase explicitly does NOT consume.
- ccusage community tool: the reference implementation for transcript-based cost parsing. Phase 6's `lib/usage.ts` is functionally equivalent but integrated.
- LightRAG roadmap (`docs/roadmap/lightrag-mcp.md`): unaffected by Phase 6; future LightRAG integration could use cost data for retrieval ranking but that's a Phase 8+ concern.
