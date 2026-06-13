# Decisions (ADR-style log)

Append-only. Each entry: number, title, date, context, decision,
consequences.

---

## ADR-001 — SQLite over JSONL for run history

**Date:** 2026-05-10

**Context.** Run history needs to power a "recent runs" card, a forecast of
upcoming scheduled tasks, and (later) an analytics view. JSONL appends
quickly but every read scans the whole file.

**Decision.** Use `better-sqlite3` with a single DB file at
`.agentic-os/state.db`. Tables: `runs`, `vault_changes`, `schedules`.
Migrations run on dashboard boot.

**Consequences.** One process at a time can write (sync API). Acceptable
because the dashboard is the only writer. The DB file is gitignored.

---

## ADR-002 — Laptop-only host, no cron

**Date:** 2026-05-10

**Context.** A reliable "always-on" laptop is not available, and managing
launchd/cron across machines is friction.

**Decision.** Local automations are shell scripts you invoke when the
laptop is open (`automations/local/*.sh`). Recurring 24/7 work goes to
**Claude Code scheduled tasks**, defined as markdown specs under
`automations/remote/*.md`.

**Consequences.** No background daemon to maintain locally. Forecast card
in the dashboard reads `automations/remote/*.md` to display upcoming runs.

---

## ADR-003 — Skills as folders, not single files

**Date:** 2026-05-10

**Context.** A SKILL.md alone limits us to ≤500 lines and forces every
helper into prose. Anthropic's spec already supports `scripts/`,
`references/`, `assets/`.

**Decision.** Every skill is a folder. SKILL.md stays under the soft cap;
deeper detail moves to `references/*.md`; deterministic checks live in
`scripts/`; templates live in `assets/`.

**Consequences.** Slight overhead per skill (one folder vs. one file).
Worth it for progressive disclosure and cleaner diffs.

---

## ADR-004 — Vendor `skill-creator` and `karpathy-guidelines` rather than
re-implement

**Date:** 2026-05-10

**Context.** Anthropic publishes a production skill-creator. forrestchang
publishes a battle-tested behavioral guidelines skill. Re-deriving either
would drift over time.

**Decision.** Clone both into `skills/_meta/` verbatim at bootstrap.
`/new-skill` and `/karpathy` slash commands invoke them. Provenance
(upstream URL + commit SHA at clone time) is recorded in this file when the
clone runs.

**Consequences.** Upstream changes do not auto-update; we re-vendor on
demand. Acceptable — both upstreams are stable.

**Provenance:**

- `skills/_meta/skill-creator/` ← [`anthropics/skills`](https://github.com/anthropics/skills)
  @ `f458cee31a7577a47ba0c9a101976fa599385174` (cloned 2026-05-10).
- `skills/_meta/karpathy-guidelines/` ← [`forrestchang/andrej-karpathy-skills`](https://github.com/forrestchang/andrej-karpathy-skills)
  @ `2c606141936f1eeef17fa3043a72095b4765b9c2` (cloned 2026-05-10).
- `template/SKILL.md` ← `anthropics/skills/template/SKILL.md` @ same SHA as
  `skill-creator` above.
- `skills/_meta/grill-me/` and `skills/_meta/grill-with-docs/` ←
  [`mattpocock/skills`](https://github.com/mattpocock/skills)
  @ `694fa30311e02c2639942308513555e61ee84a6f` (cloned 2026-06-11). Bodies
  verbatim; `license` + `metadata` frontmatter added to pass the validator.
- `skills/_meta/prototype/`, `skills/_meta/tdd/`, `skills/_meta/to-issues/`,
  and `skills/_meta/to-prd/` ← [`mattpocock/skills`](https://github.com/mattpocock/skills)
  @ `694fa30311e02c2639942308513555e61ee84a6f` (cloned 2026-06-11, same SHA).
  Bodies verbatim; same frontmatter treatment. These back the agentic
  workflow SOP at `standards/agentic-workflow.md`.

To re-vendor: clone the upstream, copy the subtree, update the SHA above,
commit. No automated sync — that's intentional (see decision body).

---

## ADR-006 — Named-agent runs trust handoffs without per-skill opt-in

**Date:** 2026-05-16

**Context.** Phase 6.5 added a `metadata.handoff: true` opt-in so accidental
`next-task:` emissions from ad-hoc skill runs would not fan out. Phase 6.7's
auto-spawn (commit 8179e8a) posts to `/api/run` with `{ prompt, agent,
taskId }` and no `skillSlug`. With no skill in context, the opt-in check in
`/api/run` dropped every handoff with "(adhoc) did not opt in", silently
breaking the multi-agent chain the gate depended on.

**Decision.** When `body.agent` is set on a `/api/run` call (i.e., a named
member agent is running), treat the run as a trusted handoff source and
honor `next-task:` events without requiring `metadata.handoff: true` on the
underlying skill. Ad-hoc skill runs (no `agent` set) still need the opt-in.

**Consequences.** Member agents can chain through whichever skills suit each
task without the skill author having to remember to flip the flag. The
opt-in remains the safety rail for free-form prompt runs from the workbench.
Cost: a member agent that emits a malformed `next-task:` will now enqueue a
bad child task; mitigation is the agent system prompt, not the route.

---

## ADR-007 — Routing matcher uses agent description, not just skill names

**Date:** 2026-05-16

**Context.** The original research-lead matcher scored teammates by
substring-matching `allowed-skills` names against the task prompt. This
worked for prompts that named a skill ("arxiv ML papers" → arxiv-watcher)
but failed open-ended healthcare-policy prompts ("NIH stance on FHIR-RAG")
because no teammate had "NIH" or "FHIR" in any skill name. The gate
exit criteria depended on such routing succeeding.

**Decision.** Lead routing now scores against the teammate's agent profile
`description` (3 points for verbatim domain-term match, 2 for synonym,
1 for skill-name substring). Agent descriptions are deliberately rich in
domain vocabulary (health-watcher names FDA/NIH/FHIR/HIPAA explicitly).
Same rubric applies to content-lead.

**Consequences.** Routing is robust to prompts that don't name a tool.
Cost: each agent description must be curated as a routing signal, not just
human-facing prose. Validator does not enforce this; failures show up as
"no teammate matched — holding" thread notes.

---

## ADR-005 — Skill frontmatter restricted to spec keys

**Date:** 2026-05-10

**Context.** Skills shipped non-compliantly drift from Claude Code's
expectations and from any future Skills marketplace. Custom top-level
frontmatter fields ("trigger", "domain", "mode") would be invisible to the
spec parser.

**Decision.** Top-level frontmatter is restricted to `name`, `description`,
`license`, `allowed-tools`, `metadata`. Custom keys live under `metadata`.
A validator script (`dashboard/scripts/validate-skills.mjs`) enforces this
on every build.

**Consequences.** All ~25 stub skills pass the spec validator from day one.
Cost: dashboard has to read `metadata.status`/`metadata.domain` instead of
the top level. Negligible.

---

## ADR-008 — Gemini CLI replaces Codex as the second runtime

**Date:** 2026-06-10

**Context.** Spec 0006 (D9) locked Codex as the second runtime, chosen for
paradigm similarity and abstraction stress-testing. Since then the operator
confirmed two paid plans to put to work: Claude Max (drives claude-code via
the logged-in CLI) and Google AI Pro (raises Gemini CLI limits via personal
Google OAuth). Codex would require a third subscription with no existing
entitlement. Gemini CLI v0.46.0 verified locally: interactive TUI under a
PTY like claude-code, `--yolo` auto-approval, `--skip-trust` suppresses the
workspace trust dialog, `--session-id <uuid>` allows self-assigned session
ids, MCP server support.

**Decision.** Supersede spec 0006 D9: `gemini-cli` is the second runtime
(spec 0007). Capabilities declared honestly: `hooks: false`,
`transcriptCostParsing: false`, `externalTerminalEscape: false`,
`sessionResume: false` (resume-by-UUID unverified; `--resume` takes
"latest" or an index), `sessionIdCapture: true` via self-assigned
`--session-id`. Codex remains a candidate third runtime; nothing in the
registry design blocks it.

**Consequences.** Agent runs can target either paid plan from the same
kanban. Runtime-capability gating (spec 0006's design) ships unchanged; the
codex.ts implementation file is simply replaced by gemini-cli.ts. Features
relying on hooks or transcripts degrade visibly for gemini runs.

---

## ADR-009 — In-dashboard scheduler narrows ADR-002

**Date:** 2026-06-10

**Context.** ADR-002 ruled out local cron because no always-on host exists
and cross-machine cron management is friction. Since then the dashboard
became a long-running local process (custom server.ts) that is already up
whenever the laptop is. Scheduled work currently only runs via remote
Claude Code scheduled tasks, which cannot file issues on the local kanban
or spawn local PTY runs.

**Decision.** The dashboard process runs its own 60-second scheduler tick
(`lib/scheduler.ts`) that fires `automations/remote/*.md` cron specs by
filing queued issues. No OS cron, no extra daemon: the schedule dies with
the dashboard, which is the ADR-002 spirit. Specs opt in via a `project:`
frontmatter key; fires missed by more than 6 hours are skipped. Remote
scheduled tasks remain the path for work that must run while the laptop is
off.

**Consequences.** One automation spec can now drive both paths. The
scheduler is doubly gated (autonomy kill switch AND a scheduler toggle)
and records state in SQLite (`schedule_state`), so re-runs are exactly
once per scheduled fire.

---

## ADR-010 — Agent handoff via local HTTP API, not stdout parsing

**Date:** 2026-06-10

**Context.** Roadmap Phase 6 designed a `next-task:` stdout protocol for
cross-agent handoffs. The current runtime renders agents in interactive
TUIs inside PTYs; their stdout is ANSI-interleaved screen painting, not a
parseable event stream. The v1 headless pipeline that could parse it is
deprecated.

**Decision.** Handoffs are HTTP: when autonomy is on, every spawned prompt
includes instructions to POST `/api/issues` with `parentIssueId` and
`status: "queued"`. The API is local-only, already validated, and the
chain is capped by `autonomy.maxChainDepth` (children past the cap land in
backlog for a human). The auto-router picks up queued children like any
other issue.

**Consequences.** Handoffs are observable (thread events, parent links in
SQLite) and survive TUI rendering changes. Cost: agents must be able to
make local HTTP calls (claude-code agents can, via Bash with curl or
WebFetch on localhost); a runtime without that ability simply cannot hand
off, which degrades gracefully.

---

## ADR-011 — Vault-backed inbox instead of live MCP queries

**Date:** 2026-06-10

**Context.** The inbox view needs Gmail context (what needs attention).
Two paths: the Next server holds Gmail OAuth and queries an MCP client
live on page load, or the existing agent pipeline (inbox-triage skill on a
schedule) writes digests to `vault/raw/daily/` and the inbox reads the
note index.

**Decision.** Vault-backed. The inbox lists recent `vault/raw/**` notes
(via the spec 0010 index), failed runs from the last 7 days, and issues in
review. The dashboard process never holds Gmail credentials; agents do,
inside worktrees, via MCP templates injected per-run.

**Consequences.** Inbox freshness equals triage cadence (scheduler-driven),
not page-load time. Acceptable for a personal dashboard, and it keeps one
credential boundary: connectors authenticate agents, not the web server.
Reversal: if near-real-time mail becomes necessary, add a read-only MCP
client in the server behind its own ADR.

---

## ADR-012 — One-shot orchestrator draft + deterministic create pipeline

**Date:** 2026-06-10

**Context.** The `/new` tab (spec 0012) turns a prompt into a repo, a
vault project, an agent crew, and kickoff issues. Two designs considered:
spawn an interactive orchestrator agent in a PTY that performs the steps
itself, or make one headless `claude -p` call for the plan and execute
everything else in plain TypeScript. Headless subscription calls draw
from the monthly Agent SDK credit pool; PTY agents emit ANSI screen
painting, not parseable events (the ADR-010 lesson).

**Decision.** Exactly one headless call (the orchestrator draft) returns
project meta + 2-4 agent profiles + 2-5 seed issues as JSON; the
pipeline (`lib/createProject/pipeline.ts`) is deterministic: preflight
before the credit is spent, `gh repo create --source . --push` for the
remote, reuse of the existing project/agent/issue mutation utilities. No
rollback: failures leave completed artifacts and report them. Existing
agent slugs are reused, never duplicated; colliding project slugs get a
numeric suffix. gh failure degrades to local-only with a warning rather
than failing the job.

**Consequences.** Cost is fixed at one credit per create; every step is
testable with injected exec/draft fakes (34 tests); progress is
observable over the existing SSE bus. The draft's quality bounds the
crew's quality — the agent editor remains the correction path. Companion
cleanup in the same build: `dashboard-v1/` (deprecated first build) was
deleted from the working tree; it remains in git history.

---

## ADR-013 — Native vault RAG: BLOB cosine scan, hash-keyed embedding cache, CLI answer providers

**Date:** 2026-06-11

**Context.** Spec 0013 adds retrieval-augmented answering over the vault.
Three contested choices: vector storage (a native extension like
`sqlite-vec` vs plain BLOBs scanned in process), embedding cache identity
(chunk ids vs content hashes — the spec 0010 indexer full-rebuilds on
every vault change, so row identity is unstable), and answer generation
(API key, headless `claude -p`, or the logged-in CLIs).

**Decision.** Embeddings live as L2-normalized Float32 BLOBs in
`chunk_embeddings`, scanned with an in-process dot product; no native
vector dependency. The cache is keyed by `(content_hash, model)`, so
embeddings survive index rebuilds and only changed content is re-embedded.
Answers are one-shot CLI calls behind a provider setting: `gemini-cli`
default (bills the Google AI Pro account), `claude-cli` explicit opt-in
(draws from the Agent SDK credit pool — no new uncontrolled `claude -p`
sites, same one-call/no-retry policy as agent drafting and the create
orchestrator), or `none` (retrieval-only). Retrieval degrades gracefully:
without an embedding provider, FTS + wikilink-graph retrieval still work.

**Consequences.** Zero new native modules (the Windows build stays
boring); a full cosine scan at current vault scale (low thousands of
chunks) costs single-digit milliseconds; embedding spend is proportional
to edits, not rebuilds. Cost: O(chunks) per query and no ANN index.
Reversal: if the vault grows ~100x, adopt `sqlite-vec` behind the existing
provider/scan seam — a contained swap, recharts-style, not a redesign.
The same applies to answer providers: a direct API provider can slot in
behind `answerProvider` if CLI latency becomes the bottleneck.


---

## ADR-014 — NotebookLM via export folder; Office/Google connectors stay MCP template slots

**Date:** 2026-06-11

**Context.** Spec 0017 wants "send to NotebookLM" from the dashboard plus
Outlook/Word/Excel/Google Docs connectivity. NotebookLM has no general
public API; Drive is its import path. The candid options were a googleapis
OAuth client inside the dashboard, a Drive MCP server, or a plain export
folder. ADR-011 established that the dashboard holds no live credentials.

**Decision.** "Send to NotebookLM" writes a markdown bundle (flattened
wikilinks + `_manifest.md`) to a configurable local folder
(`settings.export.notebookLmDir`). Pointed at a Google Drive for Desktop
synced folder, bundles appear in Drive with zero credentials and NotebookLM
imports them from there; the empty default falls back to
`vault/outputs/notebooklm/` so bundles are at least git-synced. Office and
Google connectors (`gdrive`, `gdocs`, `ms365`) ship as MCP template slots in
the connections hub (the spec 0011 linkedin pattern): a recommendation in
the setup steps, no code coupling, configured by the operator when needed.

**Consequences.** The credential boundary stays where ADR-011 put it
(agents hold credentials via MCP inside runs; the dashboard never does).
The bridge works offline and degrades to a vault folder. Cost: import into
NotebookLM remains a manual click, and the MCP server ecosystem churn is
deliberately somebody else's problem until a slot is configured. Reversal:
a direct Drive API upload can slot in behind the same export route if the
manual import becomes real friction.


---

## ADR-015 — Session index: summaries in SQLite, transcripts parsed on demand

**Date:** 2026-06-11

**Context.** Spec 0018 surfaces CLI transcripts (Claude Code, Gemini CLI)
in the dashboard with token analytics. Three storage options: parse every
file on every request with an in-process mtime cache (dies on dev reload,
re-scans hundreds of multi-MB files for analytics), index full message
bodies into SQLite (large blob churn for data the views page through
anyway), or index summaries only.

**Decision.** A `sessions` row per transcript file (migration V7) holds
summary stats keyed by `file_path` with `(mtime, size)` change detection;
the detail view re-reads the JSONL on demand, paginated. Charts are
hand-rolled SVG (bars, heatmap) rather than a chart library. Cost
estimation uses an in-code per-MTok pricing table with longest-prefix
model matching; unknown models render "n/a" rather than a guessed number,
and every figure is labeled an estimate because subscription usage does
not bill per token. The dormant `runs.transcript_path` column is now
written at session-id capture time by globbing
`~/.claude/projects/*/<sessionId>.jsonl` (never by reconstructing the
munged cwd, whose drive-letter case varies on Windows).

**Consequences.** Incremental scans are cheap (only changed files parse);
analytics is a GROUP BY over hundreds of rows; the DB stays small. Cost:
the detail view does file IO per request (fine at one operator), and
gemini sessions carry no token data until their format exposes usage.
Reversal: index message bodies if full-text search over transcripts
becomes a need (it would ride the existing FTS5 machinery); adopt recharts
behind a new ADR if charts grow interactive.


---

## ADR-016 — Evals: deterministic metrics always, LLM judge double-gated

**Date:** 2026-06-11

**Context.** Spec 0020 grades finished agent runs. The contested choices:
whether judged scores blend with measured metrics, which LLM pays for the
judging, and whether grading may run unattended.

**Decision.** Two separated layers: deterministic run metrics (duration,
turns, tokens, diff stat — free, computed on every run.finalized event)
and an optional LLM-judged rubric (correctness 0.4 / efficiency 0.3 /
coherence 0.3, composite 0-100, A-F). Judged scores never blend with
measured metrics. The judge reuses the ADR-013 answer-provider mechanism
(inherit -> gemini-cli by default; one call per grade, no loops, no
retries). Unattended judging requires evals.autoGradeEnabled AND the
global autonomy switch, both off by default; the primary path is manual
per-run and sequential batch grading. Judge input is capped at 24k chars
(issue + metrics + final assistant messages), never the full transcript.

**Consequences.** Every finished run gets free metrics with zero quota
risk; judged grades are explicit, attributable spend labeled subjective
in the UI. Re-grades replace (no history). Reversal: add a grade-history
table if longitudinal judge-drift analysis becomes a need.


---

## ADR-017 — Docker management: CLI wrapper, allowlist-gated mutations, off by default

**Date:** 2026-06-11

**Context.** Spec 0021 adds compose stack visibility and lifecycle control.
Options: a Docker socket library (dockerode) versus shelling out to the
docker CLI; and how much mutation power the dashboard gets.

**Decision.** Plain `docker` CLI subprocesses with JSON output parsing
(array or NDJSON, with a `{{json .}}` fallback) — the binary abstracts the
Windows named-pipe transport that varies by engine mode, and spawnSync
matches the repo's exec posture. Reads are unrestricted; start/stop/
restart require the compose project name to be on
`settings.docker.allowlist`, names are regex-validated before argv, and
the entire feature sits behind `settings.docker.enabled` (default false).
Logs render as an ANSI-stripped tail, not a PTY.

**Consequences.** Zero new dependencies; detection cleanly splits
binary-present from daemon-reachable (Docker Desktop stopped is a normal
state on this machine). Cost: a 30s timeout bounds long compose
operations, and per-container lifecycle is deliberately absent until
needed. Reversal: adopt dockerode behind the same lib/docker.ts surface
if streaming logs or events become requirements.


---

## ADR-018 — Tutoring sessions ride the run pipeline via a dedicated scratch repo

**Date:** 2026-06-11

**Context.** Spec 0022 needs interactive tutoring sessions. Building a new
chat surface duplicates the PTY/terminal infrastructure; reusing runs
collides with the worktree requirement: createWorktree demands a git repo,
and pointing a learning project at the Agentic-OS repo itself would
duplicate the whole repo (vault included) per session and let tutors write
into a divergent vault copy.

**Decision.** A dedicated scratch repo (<workspaceRoot>/learning-scratch,
auto-git-init, idempotent) backs a "learning" dashboard project; tutoring
sessions are ordinary sync-mode issues assigned to tutor agents, and the
existing RunTerminal is the chat UI. Worktrees are honest throwaway
exercise space. Durable artifacts (session logs, syllabus updates, srs.md)
are written to vault/learning/<topic>/ by absolute path, the same contract
the deep-research skill uses. Tutors are plain agents/*.md files.

**Consequences.** Zero changes to the core run pipeline; tutors inherit
capacity caps, threads, and observability for free. Cost: each session
pays a (tiny) worktree create on the scratch repo, and stale worktrees
need the existing prune path. Reversal: a first-class no-worktree
conversation-run mode, if a second consumer (e.g. ad-hoc agent chat)
appears.


---

## ADR-019 — Design studio: Excalidraw canvas, vault-file storage, review-by-issue

**Date:** 2026-06-11

**Context.** Spec 0023 adds an architecture studio. Canvas library choice
(tldraw vs Excalidraw), where diagrams live, and how AI review happens.

**Decision.** @excalidraw/excalidraw (MIT; tldraw's SDK watermarks without
a license key), client-only via next/dynamic — the repo's standing rule
for window-touching modules. Diagrams are vault files: scene JSON + a
client-side-exported SVG + a once-created .md stub embedding it, so
Obsidian and the knowledge graph see every diagram and the server stays
rendering-free. Saves are explicit; no autosave. AI design review files a
templated issue against the project itself — the agent reads the docs and
SVGs (XML text, no vision required) plus the worktree code and writes
REVIEW-<date>.md back to the vault.

**Consequences.** One new npm dependency for the entire 0013-0023 wave;
diagrams are diffable and travel with the vault. Cost: no realtime
collaboration and no autosave by design. Reversal: tldraw behind the same
CanvasHost seam if Excalidraw's React support regresses.


---

## ADR-020: Boot-time run reconciliation; interrupted runs go to Review

**Date:** 2026-06-12

**Context.** `finalizeRunExit` is the only writer of `runs.ended_at`, driven
by the in-process `pty.onExit` listener (startRun.ts). A hard restart, crash,
or power loss kills the PTY children and wipes the in-memory `liveRuns` Map
without that listener completing, so interrupted runs keep `ended_at IS NULL`.
Because `assertCapacity` counts every `ended_at IS NULL` row against the
per-project and global concurrency caps, accumulated phantom runs permanently
wedge the auto-router (ConcurrencyCapError on every spawn). The issue stays in
`running` and the git worktree is orphaned. ADR-001 (single SQLite writer) and
the single-instance localhost design mean that at boot the live Map is empty,
so any active run row is provably orphaned.

**Decision.** `ensureServerBooted` runs a reconciliation pass before
`startAutoRouter`. It scans `listActiveRuns()` and, for each orphan, writes
`ended_at = now` with a new distinct `exit_status = "interrupted"` (kept
separate from `failed` so evals/analytics do not score a power cut as an agent
failure), appends a `run.interrupted` thread event, and moves the issue to
`review`. Interrupted issues surface in the inbox flagged "interrupted"; the
human chooses resume, requeue, or discard. No automatic requeue: runs are not
idempotent (worktrees are issue-id-keyed and would be reused dirty,
create-project runs may have already executed `gh repo create`, handoff
children may already be POSTed). Worktrees are left in place for inspection and
handled by the existing prune path.

**Consequences.** The router can never deadlock on phantom capacity; recovery
is observable and human-gated, matching the no-rollback, cap-overflow-to-backlog
posture of ADR-010 and ADR-012. Cost: interrupted work needs one manual touch
to resume, and a distinct `interrupted` status threads through the run-status
enum, the inbox query, and the evals filter. Reversal: a future opt-in
auto-resume for provably-idempotent skills could slot in behind a per-skill
`metadata.resumable` flag without changing the reconciliation pass.


---

## ADR-021: Reflection loop with one judge-triggered revision, then Review

**Date:** 2026-06-12

**Context.** ADR-016 grades finished runs with an LLM judge
(correctness/efficiency/coherence) behind the autoGrade + autonomy double
gate, but the grade is only recorded; agents do not self-correct. The roadmap
wanted a reflection/critic loop. The planning-doc design (intercept stdout,
max_retries=2) assumes a parseable headless pipeline that ADR-010 deprecated in
favor of PTY runs and HTTP handoffs.

**Decision.** When `gradeRunWithJudge` returns a composite below a configurable
threshold (`evals.reviseThreshold`, default set in the PRD), and only under the
existing autoGrade + autonomy double gate, the autoGrade worker files exactly
one revision task: a new queued issue with `parentIssueId` set, assigned back to
the same agent, whose body carries the judge's critique. Capped at one
auto-revision round per issue (tracked via parent-chain depth, reusing the
ADR-010 mechanism). If the revision still grades below threshold, the issue
escalates to Review for a human rather than looping again. Non-revisable runs
(interrupted, failed) never trigger a revision.

**Consequences.** Agents self-correct once, cheaply, with bounded spend (one
judge call plus at most one extra run per issue), matching the reliability-first,
no-runaway posture. The loop inherits ADR-016's double gate, so it is off by
default and never fires during manual grading. Cost: one revision is a weak
corrector for deep errors; escalation-to-Review is the backstop. Reversal: raise
the cap behind `evals.maxRevisionRounds` if one round proves insufficient,
without changing the trigger or the handoff.


---

## ADR-022: Validation contracts in the issue body; per-assertion judge grading; structured worktree handoff

**Date:** 2026-06-12

**Context.** The ADR-016 judge grades finished runs on a generic
correctness/efficiency/coherence rubric drawn from the last few assistant
messages, and the spec-0026 reflection loop revises against that single
correctness number. The Factory missions talk names the weak link: correctness
defined after the code confirms decisions rather than catching bugs, and a
revision instruction of "score 62, try harder" carries little signal. Their fix
is a validation contract authored during planning, independent of
implementation, plus structured handoffs so agents write down what happened
instead of hoping to remember. The issue templates here already emit ad-hoc
"Acceptance:" lines, and the judge already receives the issue body.

**Decision.** Three parts.

1. **Contract in the issue body.** An optional `## Acceptance contract` section
   holds a checklist of assertions, authored at planning time (by the PRD/grill
   flow, the create orchestrator, or by hand). No new table; it travels with the
   issue and is diffable on the kanban.
2. **Per-assertion grading with fallback.** When a contract is present, the judge
   evaluates each assertion pass or fail with a short reason and derives
   `correctness` from the pass fraction; efficiency and coherence stay as the
   ADR-016 secondary signals and the composite weighting is unchanged. The judge
   reply schema gains an optional `assertions: [{text, pass, reason}]`. With no
   contract, the judge uses the existing generic rubric, so nothing regresses.
   The spec-0026 revision critique names the failed assertions instead of a bare
   score.
3. **Structured handoff in the worktree.** Every run writes `HANDOFF.md` in its
   worktree by absolute path (the existing agent file-writing contract):
   completed, remaining, commands run with exit codes, issues discovered, and a
   per-assertion self-assessment. `finalizeRunExit` reads it from
   `run.worktreePath` before prune, parses it into a `run.handoff` thread event,
   and passes it to the judge as grading context. A missing handoff is noted in
   the thread and does not block grading.

**Consequences.** The contract, the handoff self-assessment, and the grade all
reference the same assertions, so revision instructions are specific and
observability improves. The judge still infers pass or fail from the transcript
and diff, not by running the app; the behavioral validator that actually
exercises the app is a deferred separate spec, and this contract is what it will
check. Cost: planning now includes writing assertions (optional, degrades to
today's behavior when absent), and the judge prompt grows by the contract plus
handoff within the existing 24k-char budget. Reversal: promote contracts to vault
files behind the same parser if missions grow multi-feature, or add a
`contract_assertions` table if cross-issue assertion analytics become a need.


---

## ADR-023 — Antigravity (`agy`) as the third runtime

**Date:** 2026-06-12

**Context.** ADR-008 made Gemini CLI the second runtime and left Codex as a
notional candidate third, blocked only by a missing entitlement. Google
Antigravity then shipped `agy`, an interactive coding CLI the operator can run
under the same PTY model as claude-code and gemini-cli. Unlike the npm-shimmed
CLIs, `agy` is a real executable installed to a fixed location
(`%LOCALAPPDATA%\agy\bin` on Windows, `~/.local/share/agy/bin` elsewhere) whose
PATH entry only reaches processes started after `agy install`. It also accepts
the initial prompt directly as a flag (`--prompt-interactive`), which removes the
ConPTY type-then-delayed-Enter dance the other two need.

**Decision.** Register `antigravity-cli` (`agy`) as a third runtime
(`dashboard/lib/runtime/antigravity-cli.ts`, registered in `server-init.ts`
alongside the other two), superseding ADR-008's "Codex as candidate third
runtime." The binary is resolved to its documented absolute install path with a
PATH fallback so a dashboard already running at install time still finds it.
Spawn is `agy --prompt-interactive <prompt> --dangerously-skip-permissions`
(the worktree bounds the blast radius; there is no first-run trust dialog to
clear). Capabilities are declared honestly: `sessionResume: true` (via
`agy --continue`, which is cwd-scoped and so reliable because each run owns its
worktree), `sessionIdCapture: false` (agy exposes no preset/captured conversation
id, so the runtime self-assigns a marker UUID purely for the run row and the
open-in-terminal route), `hooks: false`, `transcriptCostParsing: false`,
`externalTerminalEscape: true`. `models` is left empty because `agy models`
requires auth and cannot be enumerated at build time; the editor's free-text
Custom field covers any authenticated model id.

**Consequences.** Agent runs can target a third provider from the same kanban,
and runtime-capability gating (spec 0006's design) ships unchanged — the new
runtime is purely additive. This also widens the deferred role-based
model-assignment idea from two seats to three (planning, implementation, and
validation can each target a different runtime to dodge shared-training bias).
Cost: features that depend on hooks or transcript parsing degrade visibly for
`agy` runs, same as gemini. Reversal: nothing in the registry blocks dropping a
runtime; deregistering it in `server-init.ts` is the whole rollback.


---

## ADR-024: Domain glossary as shared vocabulary, injected at spawn

**Date:** 2026-06-13 (Spec 0031, Phase 12)

**Context.** ADR-007 routing scores an issue against agent descriptions and spec
0028 enriched those descriptions, but operator and agents still drift on what a
term means and a task that omits its intent forces the agent to guess. The roadmap
parked a domain glossary plus a per-task "why" as the cheapest precision win.

**Decision.** Keep one glossary source of truth at `product/glossary.md` (canonical
term, one-line definition, optional aliases). Parse it once into a compact,
budget-capped context block (`lib/glossary.ts`) that `startRun` prepends to the
agent context the run already receives. Add an optional `## Why` line to issue
templates, threaded to the agent. Expand the ADR-007 scorer so a glossary alias
matches as its canonical term. All four are additive and default to today's
behavior when the glossary or the why line is absent.

**Consequences.** Vocabulary stays consistent across runs and routing without a new
table or UI, and intent travels with the task. Cost: a small character budget spent
on context, and the glossary must be maintained by hand. Reversal: delete
`product/glossary.md` and the context block goes empty; the scorer change is inert
without aliases.


---

## ADR-025: Behavioral validator exercises the app against the spec-0029 contract

**Date:** 2026-06-13 (Spec 0032, Phase 12)

**Context.** Spec 0029 grades each contract assertion, but the ADR-016 judge only
reads the transcript and diff; it never runs the app, so a feature that is broken
in the browser can still grade well. Spec 0029 named this validator as its intended
consumer and left it for a separate spec. The vendored Playwright skill and the
known `npm run dev` launch path are the missing-nothing pieces.

**Decision.** Mark the behaviorally-testable assertions in the `## Acceptance
contract` (an `(e2e)` marker). A harness (`lib/evals/behavioral.ts`) launches the
app against the run worktree, drives the marked assertions via the Playwright
skill, and emits per-assertion pass, fail, or inconclusive with a reason and
optional screenshot, under a hard timeout. The whole path is gated by a default-off
`behavioralValidator` flag. Results feed `buildJudgePrompt`; a behavioral fail
forces that assertion to fail in the judge reconciliation. Unmarked assertions stay
judge-only.

**Consequences.** The user-testing half of the scrutiny-versus-user-testing split
lands without changing spec 0029 when the flag is off. Cost: browser automation is
slow and flaky, so it is opt-in and timeout-bounded, and CI uses an injected driver.
Reversal: turn the flag off; nothing else depends on the harness.


---

## ADR-026: Role-based model assignment routes validation to a different runtime

**Date:** 2026-06-13 (Spec 0033, extends ADR-023, Phase 12)

**Context.** ADR-023 gave the registry a third seat, and the Factory argument is
that a model grading its own work shares its blind spots. Today a run targets one
runtime and the judge runs on the eval default, so plan, implementation, and
validation can collapse onto one provider.

**Decision.** Add an optional, default-off `roleAssignment` map in settings from
`plan` / `implement` / `validate` to a runtime id. When `validate` is set, the
ADR-016 judge and the spec-0026 revision spawn on that runtime; unset leaves the
eval path unchanged. Resolution reuses the existing model-and-runtime threading onto
the run row, checks capability flags from `lib/runtime/types.ts`, and falls back to
the default with a visible downgrade log when a mapped runtime is unavailable.
Per-agent `model` frontmatter still wins for the implementation seat.

**Consequences.** The validator can run on a different model from the implementer
without a new spawn mechanism, and the feature is inert until the operator sets the
map. Cost: a misconfigured map degrades to the default rather than erroring, which
must be logged so it is not silent. Reversal: clear the map.


---

## ADR-027: Mission/epic layer above issues, with dependency-ordered routing

**Date:** 2026-06-13 (Spec 0034, Phase 12)

**Context.** The board is a flat issue list; a multi-issue initiative lives only in
handoff chains (ADR-010) with no object grouping it or rolling up its grades. The
Factory missions talk calls this tier the orders-of-magnitude-harder-tasks unlock,
and spec 0029 left the epic layer out of its scope.

**Decision.** Add a first-class `epics` table plus `epic_id` and optional
`depends_on` on issues (additive migration in `lib/db.ts`). An epic owns a shared
contract and a milestone and derives a rollup status from its children's spec-0029
contracts and grades (`lib/epics.ts`). The auto-router excludes a child with an
unmet `depends_on` and runs independent children of the same epic concurrently up
to the existing capacity cap, which settles the parked serial-versus-parallel fork
as parallel-across-independent, serial-within-dependent. GitHub milestone mapping is
optional.

**Consequences.** Multi-issue missions become first-class without a parallel system,
reusing the issues table, the router, and the kanban. This is the largest Phase 12
spec and the one that forces the execution-model fork. Cost: a schema migration and
a new view. Reversal: the migration is additive, so dropping the epics view and
ignoring `epic_id` leaves issues working standalone.
