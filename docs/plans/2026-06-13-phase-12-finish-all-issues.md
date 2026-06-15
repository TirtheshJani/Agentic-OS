# Finish all open GitHub issues (Phase 12) — Multi-Agent Implementation Plan

> **For agentic workers:** Each issue is one dispatched agent working in an isolated git worktree, TDD, then auto-merged after green. Steps use checkbox (`- [ ]`) syntax. Follows the **karpathy-guidelines** skill: minimum surgical code, additive, default-off, no speculative abstraction.

**Goal:** Close all 13 open issues (#52–#64), which are the four Phase-12 spec tracks (0031 glossary, 0032 behavioral validator, 0033 role-based model assignment, 0034 mission/epic layer).

**Architecture:** Dispatch one agent per issue across dependency-ordered waves; within a wave, agents touch **disjoint files** so they run in parallel worktrees with zero collision; merge in a fixed order with `npm test` green-gating after each.

**Tech Stack:** Next.js 15 + React 19 + TypeScript (strict), vitest, custom `tsx server.ts`, SQLite (`better-sqlite3`), zod settings, vendored `playwright-skill`.

**Decisions captured from operator:** one PR per issue (13 PRs); auto-merge each after green tests; install Chromium and verify #58/#59/#60 live.

---

## Context

The board has 13 open issues, all Phase 12 ("compounding quality wave"), grouped into four independent specs that already exist in `specs/` with accepted ADRs (024–027 in `product/decisions.md`):

- **0031 domain glossary** (ADR-024): #52 → {#53, #54}
- **0032 behavioral e2e validator** (ADR-025): #58 → #59 → #60
- **0033 role-based model assignment** (ADR-026): #55 → {#56, #57}
- **0034 mission/epic layer** (ADR-027): #61 → #62 → {#63, #64}

Each spec is small, additive, and default-off, so today's behavior is preserved when the new feature is unset. The work is well-scoped TypeScript with vitest fixtures; the only novel machinery is the behavioral harness (#58). The intent is to finish the entire Phase 12 wave and leave `main` green at every step.

## Prerequisites

- **API keys required: none.** Verified end-to-end. The judge/grader runs via `runCliAnswer` → `gemini-cli` (Google AI Pro **subscription**, already logged in), not an API key. `rag.geminiApiKey` is only for embeddings, which default to `none` (disabled). Runtimes (claude-code, gemini-cli, antigravity-cli) are subscription CLIs already authenticated. Optional GitHub milestone mapping (#64) uses the already-authenticated `gh` CLI.
- **One-time setup for live behavioral verification (chosen):** `cd C:/Users/TJ/.claude/skills/playwright-skill && npm run setup` (installs Playwright + Chromium). Needed only to drive the real browser for #58/#59/#60; unit tests use a fake driver and do not need it.
- **CLIs stay logged in:** `gemini-cli` / `antigravity-cli` (`agy`) — only matters if you later set `validate → gemini-cli/antigravity` (spec 0033). Already configured per machine notes.

## Operating rules (apply to every dispatched agent)

- All JS commands run from `dashboard/`. Gate: `npm test` (vitest). Also run `npm run validate:skills` / `npm run validate:automations` only if a `SKILL.md`/automation is touched (none here).
- **No em dashes** anywhere authored. TypeScript strict, named exports, type-only imports, kebab-case filenames. Prepared statements only for SQL.
- **Additive + default-off:** new flags/blocks default to today's behavior. Regression guard tests must prove "unset == unchanged."
- **Settings triple-edit rule** (from `lib/settings.ts`): a new flag/block must be added to (1) its zod sub-schema, (2) its `*_DEFAULTS`/`defaults()` literal, and (3) the `setSettings` deep-merge object. Reset via `resetSettingsForTesting()` in tests.
- **Migration rule** (from `lib/db.ts`): a new `applyVN(d)` with a `schema_migrations` version guard + `PRAGMA table_info` guard for every `ADD COLUMN`; register in `openDb`'s boot sequence after the prior `applyV{N-1}`.
- **Test rule:** `import "./helpers/repoRootStub"` **first**; per-test `AGENTIC_OS_STATE_DIR` + `openDb(tmpfile)`; `vi.mock("@/lib/rag/answer/cliAnswer", ...)` for any judge path; `resetSettingsForTesting()` / `resetRegistryForTesting()` in `beforeEach`. Mirror `tests/evals.test.ts` and `tests/db.test.ts`.

---

## Design resolutions (verified against source — do not re-litigate)

These three questions were resolved by reading the code; dispatched agents implement them as written.

### R1 — Runtime-id ↔ answer-provider-id bridge (#55/#56)

The role map stores **runtime ids** (`claude-code` | `gemini-cli` | `antigravity-cli`); the judge runs via **answer-provider ids** (`AnswerProviderId = "gemini-cli" | "claude-cli"`, defined in `dashboard/lib/rag/answer/cliAnswer.ts:10`). They are different namespaces that share the literal `gemini-cli`. Bridge them with one pure function:

```ts
// dashboard/lib/runtime/roles.ts (NEW, part of #55)
import type { AnswerProviderId } from "@/lib/rag/answer/cliAnswer";
export function runtimeToAnswerProvider(runtimeId: string): AnswerProviderId | null {
  switch (runtimeId) {
    case "claude-code": return "claude-cli";
    case "gemini-cli":  return "gemini-cli";
    default:            return null; // antigravity-cli: no one-shot -p answer CLI
  }
}
```

It plugs into `resolveJudgeProvider()` in `dashboard/lib/evals/judge.ts:62` (currently: `evals.judgeProvider === "inherit" ? rag.answerProvider : evals.judgeProvider`, with `"none" → null`). New precedence, additive: if `roleAssignment.validate` is set, map it; if the mapping is `null` (e.g. antigravity), emit exactly **one** `console.info` downgrade line and fall through to the existing chain. Never throw, never silently disable.

**`revise.ts` is NOT changed.** `fileRevision(runId)` only creates a child issue; it spawns no LLM and references no runtime. The validate seat applies to the **judge call only**. (The issue title implies a revise.ts change the code does not justify — note this in #56's PR.)

### R2 — `lib/evals/behavioral.ts` shape (#58)

```ts
// dashboard/lib/evals/behavioral.ts (NEW)
export interface BehavioralResult {
  assertion: string;
  status: "pass" | "fail" | "inconclusive";
  reason: string;
  screenshotPath?: string;
}
export interface BehavioralDriver {                       // the injection seam
  launch(worktreePath: string, port: number): Promise<void>;
  check(assertion: string, port: number): Promise<Omit<BehavioralResult, "assertion">>;
  close(): Promise<void>;
}
export interface BehavioralOpts {
  driver?: BehavioralDriver;   // default: PlaywrightDriver (shells to playwright-skill/run.js)
  now?: () => number;          // default: Date.now — fake clock in tests
  timeoutMs?: number;          // hard cap, default 120_000
  port?: number;               // ephemeral; default OS-assigned
}
export async function runBehavioralAssertions(
  worktreePath: string, assertions: string[], opts?: BehavioralOpts,
): Promise<BehavioralResult[]>;
```

- Default `PlaywrightDriver`: `launch()` spawns `npm run dev` with `PORT=<ephemeral>`, `AGENTIC_OS_REPO_ROOT=<worktreePath>`, isolated `AGENTIC_OS_STATE_DIR`; warm-up polls `GET /api/runtimes` until 200 (per `dashboard/server.ts` launch path). `check()` writes a temp Playwright script, runs `node run.js <script>`, parses stdout + reads the screenshot path.
- **Tests inject a `FakeDriver`** (plain object literal) + a fake clock (`let t=0; now=()=>t`). No real browser, no real timer in CI.
- **Timeout:** before each `check`, if `now() - start > timeoutMs`, mark the current and all remaining assertions `inconclusive` ("behavioral timeout") and break. `close()` always runs in `finally`.
- **Infra failure posture:** any launch/driver error → all assertions `inconclusive` (never `fail`), mirroring the judge's "infra errors don't score as agent failure."

### R3 — Where the harness hooks in (#59)

Hook into `gradeRunWithJudge()` in `dashboard/lib/evals/store.ts:70`, **immediately before** the `buildJudgePrompt` call at `store.ts:81` — **not** `autoGrade.ts` (a thin gate) and **not** `startRun finalizeRun` (synchronous, race-prone, idempotent). `gradeRunWithJudge` already calls `parseContract(issue.body)` (store.ts:77) and has `run.worktreePath` in hand. Insert: if `getSettings().evals.behavioralEnabled` AND the contract has any `e2e` assertions, call `runBehavioralAssertions(...)`, fold results into `buildJudgePrompt` (new optional `behavioral?` arg) so the judge sees observed pass/fail, and persist them on the rubric. A behavioral `fail` forces that assertion to fail; `inconclusive` is not a fail.

---

## Multi-agent dispatch orchestration

**Mechanism:** for each wave, dispatch one `general-purpose` agent per issue with `isolation: "worktree"` (parallel within a wave). Each agent: branches `agentic-os/issue-N` from latest `main`, implements TDD, runs `npm test` green, commits. The orchestrator then pushes the branch, opens a PR (`gh pr create` body `Closes #N`), confirms green, and **auto-merges** (`gh pr merge --squash --delete-branch`) in the deterministic order, running `npm test` on the updated `main` before the next merge.

**Wave grouping (each wave is file-disjoint internally):**

| Wave | Issues (parallel) | Files each touches (no overlap within wave) |
|------|-------------------|---------------------------------------------|
| **A** | #52, #61, #55, #58 | glossary.ts(new)+md / db.ts / settings.ts+roles.ts(new) / behavioral.ts(new)+contract.ts |
| **B** | #54, #62, #57, #53 | orchestrator/router.ts / epics.ts(new) / app/settings / startRun.ts+issueTemplates.ts |
| **B2** (serial) | #56 **then** #59 | judge.ts+startRun.ts(seat) ; then settings.ts+store.ts+judge.ts |
| **C** | #63, #64, #60 | orchestrator/autoRoute.ts / app+issueTemplates.ts / app/evals+run UI |

**Hard barriers (collision control — confirmed by file-touch audit):**
1. **Merge all of Wave B before B2 begins.** #53 and #56 both edit `startRun.ts` (disjoint regions: #53 context ~L211–235, #56 seat resolve ~L138–158). #56's worktree must branch from a `main` that already has #53.
2. **#56 merges before #59.** Both edit `judge.ts`; #59 also edits `settings.ts` (stacks on #55's block). That is why B2 is serial.
3. **#63 puts dependency-gating in `autoRoute.ts`, not `router.ts`** — keeps it file-disjoint from #54 (which edits `router.ts` scoring). Confirmed by spec wording ("the auto-router excludes children").
4. **#64 rebases on post-#53 `main`** before adding `depends_on` to `issueTemplates.ts` (stacks on #53's `## Why` addition).

**Deterministic merge order:** `52, 61, 55, 58, 54, 62, 57, 53, 56, 59, 63, 64, 60`.

---

## Per-issue task specs

Each block is the brief handed to that issue's agent (plus the issue body, its spec section, and the relevant R1/R2/R3 resolution). Acceptance criteria are copied from the issue's contract.

### WAVE A

#### #52 — Glossary source + parser  `[track 0031]`
- **Create:** `product/glossary.md` (entries: canonical term, one-line definition, optional comma-separated aliases); `dashboard/lib/glossary.ts`; `dashboard/tests/glossary.test.ts`.
- **Signatures:** `interface GlossaryTerm { term: string; definition: string; aliases?: string[] }`; `parseGlossary(md: string): GlossaryTerm[]`; `glossaryContextBlock(terms: GlossaryTerm[], budget: number): string`. Return `[]` / `""` on missing/empty/malformed; skip a malformed line, never throw.
- **Tests:** N terms from a well-formed file; `[]` from missing/empty; malformed line skipped without throwing; `glossaryContextBlock` never exceeds the char budget.
- **Accept:** all four contract boxes; `npm test` green.

#### #61 — Epic data model migration  `[track 0034]`
- **Modify:** `dashboard/lib/db.ts` (new `applyV10`); **Create:** `dashboard/tests/epics.test.ts`.
- **Work:** `applyV10(d)` mirroring `applyV9` — `CREATE TABLE IF NOT EXISTS epics (id, project_slug, title, why, shared_contract, milestone, status, created_at, updated_at)`; `ALTER TABLE issues ADD COLUMN epic_id INTEGER` and `ADD COLUMN depends_on TEXT` each guarded by `PRAGMA table_info(issues)`; version-10 guard via `schema_migrations`; register `applyV10(db)` in `openDb` boot after `applyV9`.
- **Tests:** migration adds table + columns; idempotent on a second `openDb`; existing issues still load with the new nullable columns.
- **Accept:** all contract boxes; `npm test` green.

#### #55 — roleAssignment config + resolver  `[track 0033]`
- **Modify:** `dashboard/lib/settings.ts` (new default-off top-level `roleAssignment` block, triple-edit); **Create:** `dashboard/lib/runtime/roles.ts` (R1's `runtimeToAnswerProvider`); `dashboard/tests/role-assignment.test.ts`.
- **Signatures:** `roleAssignment: { plan?: string; implement?: string; validate?: string }` (runtime ids or unset), default `{}`. Optional helper in `lib/runtime/` to resolve a role → available runtime via existing `resolveRuntime` + capability check + fallback.
- **Tests (faked registry):** unset == today's behavior (regression); a mapped-but-unavailable runtime falls back to default and emits a downgrade log, not a failure; `runtimeToAnswerProvider` mapping incl. `null` for antigravity.
- **Accept:** all contract boxes; `npm test` green.

#### #58 — Behavioral validator harness  `[track 0032]`
- **Create:** `dashboard/lib/evals/behavioral.ts` (R2); `dashboard/tests/behavioral.test.ts`. **Modify:** `dashboard/lib/evals/contract.ts` (tag each `Assertion` with `e2e: boolean` from a trailing `(e2e)` marker; additive — unmarked assertions parse identically).
- **Tests (FakeDriver + fake clock):** `parseContract` tags `(e2e)` assertion as behavioral, leaves others judge-only; harness emits pass / fail / inconclusive with reason; launch failure → inconclusive (no throw); timeout respected (fake clock trips it → remaining inconclusive).
- **Accept:** all contract boxes; `npm test` green. (Live Chromium check deferred to Verification.)

### WAVE B  *(after Wave A merged)*

#### #54 — Routing credits glossary aliases  `[track 0031, dep #52]`
- **Modify:** `dashboard/lib/orchestrator/router.ts` — in `routeIssue`, when an issue token matches a glossary **alias** of a term used in an agent's description, credit the canonical term (alias scores like a description hit, weight 3). Reuse `lib/glossary.ts`; keep tie-break alphabetical and reproducible.
- **Tests:** an issue using only an alias routes to the same lead as one using the canonical term; routing for terms absent from the glossary is unchanged (regression).
- **Accept:** all contract boxes; `npm test` green.

#### #62 — Epic CRUD + rollup + eligibleChildren  `[track 0034, dep #61]`
- **Create:** `dashboard/lib/epics.ts` (mirrors `lib/issues.ts` style); extend `dashboard/tests/epics.test.ts`.
- **Signatures:** `createEpic`, `getEpic`, `listEpics`, `updateEpic`, `deleteEpic`; `rollupStatus(epicId): "empty" | "in-progress" | "done"` (done only when every child passes its spec-0029 contract, derived not stored); `eligibleChildren(epicId): Issue[]` (excludes children with unmet `depends_on`).
- **Tests:** `rollupStatus` — empty epic is `empty` not `done`, `done` only when all children pass, else `in-progress`; `eligibleChildren` excludes unmet-dependency children, includes independent ones.
- **Accept:** all contract boxes; `npm test` green.

#### #57 — Settings UI for role-to-runtime  `[track 0033, dep #55, HITL]`
- **Modify:** `dashboard/app/settings/page.tsx` — add a control (one dropdown per role: plan / implement / validate) sourced from `listRuntimes` (via `GET /api/runtimes`), with an "unset" option; persists to the `roleAssignment` block through the existing `PATCH /api/settings` round-trip. Match the existing theme-dropdown pattern in the same file.
- **Tests:** settings round-trip (set, reload, persists); only registered runtimes selectable; unset roles render cleanly and keep default behavior.
- **Accept:** all contract boxes; `npm test` green. Visual review at Verification.

#### #53 — Inject glossary block + `## Why`  `[track 0031, dep #52]`
- **Modify:** `dashboard/lib/startRun.ts` (prepend `glossaryContextBlock(...)` into the assembled agent context ~L211–235, inside the existing prompt budget, when `product/glossary.md` exists); `dashboard/lib/issueTemplates.ts` (emit an optional `## Why` line and thread it into run context); `standards/agent-authoring.md` (document the glossary as shared vocabulary).
- **Tests:** spawned run context contains the glossary block when the file exists; **context byte-identical to today when the glossary is absent** (regression guard); a `## Why` line reaches context, its absence changes nothing.
- **Accept:** all contract boxes; `npm test` green.

### WAVE B2  *(serial: #56 then #59; both after Wave B merged)*

#### #56 — Judge spawns on validation runtime  `[track 0033, dep #55, after #53]`
- **Modify:** `dashboard/lib/evals/judge.ts` (`resolveJudgeProvider` precedence per R1 + downgrade log); `dashboard/lib/startRun.ts` (resolve the `implement` seat from the map at ~L138–158, **per-agent `model` frontmatter still wins**). **`revise.ts` untouched** (R1) — state this in the PR.
- **Tests:** with `validate` set to an available runtime, the judge spawn targets it (assert on resolved provider / run row); unset leaves the eval path unchanged (regression); per-agent `model` frontmatter wins for the implement seat when both present; antigravity `validate` logs downgrade and falls back.
- **Accept:** all contract boxes; `npm test` green.

#### #59 — Wire behavioral results into finalize + judge  `[track 0032, dep #58, after #56]`
- **Modify:** `dashboard/lib/settings.ts` (add default-off `evals.behavioralEnabled` flag, triple-edit); `dashboard/lib/evals/store.ts` (`gradeRunWithJudge`: run harness before `buildJudgePrompt` when flag on + e2e assertions exist, stash results on rubric — R3); `dashboard/lib/evals/judge.ts` (`buildJudgePrompt` accepts optional `behavioral?: BehavioralResult[]`; a behavioral fail forces that assertion to fail in reconciliation; inconclusive is not a fail).
- **Tests (mocked harness + cliAnswer):** flag off → finalize/grading byte-for-byte today's (regression); behavioral fail forces that assertion's correctness contribution to fail; finalize completes even when the app hangs (timeout-bounded); behavioral runs before the judge.
- **Accept:** all contract boxes; `npm test` green.

### WAVE C  *(after B2 merged)*

#### #63 — Router respects epic dependency order  `[track 0034, dep #62]`
- **Modify:** `dashboard/lib/orchestrator/autoRoute.ts` — before routing/starting, exclude a child whose `depends_on` is unmet (via `eligibleChildren`), staying queued (reuse the existing concurrency-held pattern); independent children of the same epic still run concurrently up to the capacity cap. Leave `router.ts` scoring untouched (disjoint from #54).
- **Tests:** the router does not pick a child whose dependency is unmet; it does pick that child's independent siblings; non-epic routing unchanged (regression).
- **Accept:** all contract boxes; `npm test` green.

#### #64 — Epics (missions) view above the kanban  `[track 0034, dep #62, HITL]`
- **Modify:** `dashboard/app/` epics view (render each epic, its children, dependency order, rollup status; mount above `<KanbanBoard />` in the issues view); `dashboard/lib/issueTemplates.ts` (allow creating an issue under an epic with a `depends_on` reference — rebase on post-#53 main); optional `dashboard/lib/github.ts` hook (map an epic to a milestone when configured; epic works without it). Add an epics API route mirroring the issues route shape.
- **Tests:** epics view renders an epic with children, dependency order, rollup status `(e2e)`; degrades cleanly with zero epics; an epic with no milestone mapping functions fully.
- **Accept:** all contract boxes; `npm test` green. Visual + live review at Verification.

#### #60 — Surface behavioral pass/fail + screenshots  `[track 0032, dep #59, HITL]`
- **Modify:** `dashboard/app/evals/page.tsx` and the run/eval detail view — per-assertion behavioral status (pass / fail / inconclusive) chips + screenshot links, read from the rubric's `behavioral` field; pane degrades cleanly when there are no behavioral results.
- **Tests:** the view shows per-assertion behavioral status `(e2e)`; screenshot links resolve when present; clean degrade when absent.
- **Accept:** all contract boxes; `npm test` green. Visual + live review at Verification.

---

## Verification (end-to-end)

1. **Per-issue gate (every agent):** `cd dashboard && npm test` green before its PR is merged. Re-run `npm test` on `main` after each merge in the deterministic order; a red `main` halts the chain (escalate, fix before continuing).
2. **Regression guards proven:** for #53/#55/#56/#59, the "unset/flag-off == today" test must pass — this is the core safety property of the whole wave.
3. **Live behavioral verification (chosen, after #58/#59/#60 merge):**
   - One-time: `cd C:/Users/TJ/.claude/skills/playwright-skill && npm run setup`.
   - Turn on the flag: set `evals.behavioralEnabled = true` (via `/settings` or settings.json).
   - Drive the real dashboard with the **playwright-skill** to confirm: (a) #60 renders per-assertion behavioral chips + a resolvable screenshot link on a run that has an `(e2e)` assertion; (b) #64 epics view renders an epic with children/dependency order/rollup and degrades to empty cleanly. Capture screenshots to `/tmp` as evidence.
   - Turn the flag back off (default-off invariant) unless you want it on.
4. **HITL visual review (#57, #60, #64):** open each surface in the running dashboard and confirm layout/usability matches `standards/dashboard-ui.md` tokens. (Auto-merge is on per the operator choice; the live check is the confidence pass.)
5. **Issue closure:** each PR body carries `Closes #N`; merging closes the issue. Confirm all 13 issues show closed and the milestone/board is clear.
6. **No artifacts/ in this repo.** The `artifacts/acceptance_log.json` convention belongs to the unrelated `stellar-mk-audit` project loaded via the parent `~/Documents/CLAUDE.md`; here the green `npm test` + merged PR is the contract.

## Self-review (run before dispatch)

- **Spec coverage:** every acceptance box in specs 0031–0034 maps to an issue task above. ✓
- **Collision audit:** within each wave the file sets are disjoint; cross-wave shared files (`startRun.ts`, `judge.ts`, `settings.ts`, `issueTemplates.ts`, `router.ts`/`autoRoute.ts`) are serialized by the merge order + hard barriers. ✓
- **Type consistency:** `GlossaryTerm`, `BehavioralResult`/`BehavioralDriver`/`BehavioralOpts`, `runtimeToAnswerProvider`, `rollupStatus`/`eligibleChildren` names are used identically across the issues that reference them. ✓
- **Default-off invariant:** glossary (absent file), `roleAssignment` (`{}`), `evals.behavioralEnabled` (`false`), `epic_id`/`depends_on` (nullable) all degrade to today's behavior. ✓
