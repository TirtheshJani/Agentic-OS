# Spec 0018 — Sessions browser + Analytics

**Status:** Shipped
**Owner:** TJ
**Date:** 2026-06-11
**Decision record:** ADR-015

Implementation follows the karpathy-guidelines skill.

## Context

Every Claude Code and Gemini CLI session leaves a transcript on disk (`~/.claude/projects/<munged-cwd>/<session-uuid>.jsonl`; `~/.gemini/tmp/<dir>/chats/session-*.jsonl`), but nothing surfaced them: no browsing, no token visibility, no link from a dashboard run to its transcript. `runs.transcript_path` existed in the schema but was never written.

## Decisions (ADR-015)

1. **Summaries in SQLite, bodies parsed on demand.** The `sessions` table (migration V7) holds one summary row per transcript file keyed by `file_path` with `(mtime, size)` change detection; the detail API re-reads the JSONL. Full message indexing would churn the DB for data the list view never queries; pure parse-on-demand would re-scan hundreds of multi-MB files for every analytics call.
2. **Hand-rolled SVG charts, no chart library.** The views need bars, a GitHub-style heatmap, and counters — static shapes, ~150 lines total, testable as pure data-to-SVG functions. recharts would be the largest UI dependency in the repo for no interactivity gain. Reversal: adopt recharts behind a new ADR if charts grow interactive.
3. **Pricing table in code, null for unknown.** `lib/usage/pricing.ts` longest-prefix matches current Anthropic per-MTok prices (fable 10/50, opus 5/25, sonnet 3/15, haiku 1/5; cache write 1.25x in, read 0.1x in). Unknown models (including all Gemini sessions) yield `null`, rendered "n/a". Every figure is labeled an estimate; subscription usage does not bill per token.
4. **Gemini sessions are best-effort.** Their state-patch format (`{"$set": {messages}}`) carries no usage fields; rows show turn counts with token columns null. Verify against newer CLI versions when they appear.

## Design

- `lib/sessions/parseClaude.ts` / `parseGemini.ts` — pure tolerant parsers (per-line try/catch; `file-history-snapshot`, `isMeta`, and sidechain records skipped — sidechains excluded entirely, noted limitation). Normalized `SessionMessage {role, text, toolCalls[{name, inputPreview, output?}], model?, timestamp}`.
- `lib/sessions/scanner.ts` — walk both roots (parameterized for tests), skip unchanged `(mtime,size)`, upsert summaries, prune rows for deleted files. `project_slug` matched from the transcript's `cwd` against `Project.path` (case-insensitive prefix or path-segment slug match); `run_id` via `runs.pty_session_id = session_id`.
- `lib/sessions/service.ts` — singleton boot scan + 5-minute unref'd interval, publishes `sessions.indexed` stream events. No settings block (deliberate: the interval is a constant until a real need appears).
- **transcript_path fix:** `registerLiveRun` (lib/runtime/liveRuns.ts) now resolves the transcript by globbing `~/.claude/projects/*/<sessionId>.jsonl` when the session id arrives and writes `runs.transcript_path`. Globbing by UUID avoids reconstructing the munged cwd directory name, whose drive-letter case varies on Windows.
- `lib/usage/analytics.ts` — SQL GROUP BY over sessions/runs/issues: daily token/cost series, per-model rollup (from the JSON `models` column), per-project, run outcomes, issue throughput ("closed" approximates as status=done bucketed by updated_at).

## API

- `GET /api/sessions?provider&project&limit&offset` → `{ sessions, total }`
- `POST /api/sessions` → manual rescan `{ scanned, updated, removed }`
- `GET /api/sessions/[id]?page=` → `{ summary, messages (200/page), totalMessages }` (404 when the file vanished; pruned on next scan)
- `GET /api/analytics?days=7|30|90|all&provider&project`

## UI

- `/sessions` — provider filter, rescan button, table (provider badge, project, started, turns, tokens or "n/a", est. cost, run chip), live refresh on `sessions.indexed`.
- `/sessions/[id]` — summary card + threaded messages (user/assistant left-border distinction, tool calls as `<details>`), 200-message pagination (no virtualization lib; revisit if a real session proves slow).
- `/analytics` — totals cards, tokens/day bars, activity heatmap, by-model and by-project tables; range + provider filters.
- Nav: Sessions and Analytics after Inbox.

## Tests

`tests/sessionParsers.test.ts` (usage accumulation, isMeta skip, bad lines, $set folding), `tests/pricing.test.ts` (prefix match, unknown → null), `tests/sessionScanner.test.ts` (synthetic temp roots: insert, mtime-skip, reparse-on-change, prune, run linking), `tests/db.test.ts` bumped to V7.

## Limitations

- Sidechain records are skipped, not rendered.
- Gemini token analytics are n/a (no usage fields in the session format observed).
- Issue "closed" series is an approximation.
- Costs are estimates from public API prices.
