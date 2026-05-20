// Ported from .design-handoff/project/data.jsx. Sample data for the new UI:
// agents, skills, projects, issues, recent runs, vault recents, activity feeds.
//
// Phase 9.1: types moved to ./types; mock consts remain here pending view
// migrations (phases 9.2-9.6). The consts are marked @deprecated so future
// greps surface every remaining call site.

export * from "./types";

import {
  type Agent,
  type ActivityEntry,
  type ColumnDef,
  type Department,
  type DeptKey,
  DEPARTMENTS,
  type Issue,
  type Project,
  type RecentRun,
  type Skill,
  type VaultItem,
} from "./types";

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const AGENTS: Agent[] = [
  { handle: "tj",           name: "TJ",            kind: "human", initials: "TJ", color: "#e8eef9", dept: null },
  { handle: "claude-lead",  name: "Lead",          kind: "agent", initials: "CL", color: "#4a8fd1", dept: "coding" },
  { handle: "researcher",   name: "Researcher",    kind: "agent", initials: "RS", color: "#4aa896", dept: "research" },
  { handle: "coder",        name: "Coder",         kind: "agent", initials: "CD", color: "#6faef3", dept: "coding" },
  { handle: "writer",       name: "Writer",        kind: "agent", initials: "WR", color: "#b388eb", dept: "content" },
  { handle: "ops",          name: "Ops",           kind: "agent", initials: "OP", color: "#e07a8f", dept: "productivity" },
  { handle: "analyst",      name: "Analyst",       kind: "agent", initials: "AN", color: "#d4a259", dept: "business" },
];

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const SKILLS: Skill[] = [
  { name: "lit-review",        family: "research",     status: "authored", cadence: "weekly",  runs: 12, lastRun: "2h ago" },
  { name: "rag-eval",          family: "research",     status: "authored", cadence: "on-demand", runs: 4,  lastRun: "3d ago" },
  { name: "paper-summary",     family: "research",     status: "stub",     cadence: null,      runs: 0,  lastRun: "—" },
  { name: "skill-creator",     family: "_meta",        status: "authored", cadence: "on-demand", runs: 34, lastRun: "9m ago" },
  { name: "blog-draft",        family: "content",      status: "stub",     cadence: null,      runs: 0,  lastRun: "—" },
  { name: "weekly-digest",     family: "content",      status: "authored", cadence: "weekly",  runs: 7,  lastRun: "yest" },
  { name: "substack-publish",  family: "content",      status: "stub",     cadence: null,      runs: 0,  lastRun: "—" },
  { name: "ts-refactor",       family: "coding",       status: "authored", cadence: "on-demand", runs: 18, lastRun: "14m ago" },
  { name: "pr-review",         family: "coding",       status: "authored", cadence: "daily",   runs: 27, lastRun: "39m ago" },
  { name: "test-author",       family: "coding",       status: "authored", cadence: "on-demand", runs: 9,  lastRun: "1h ago" },
  { name: "inbox-triage",      family: "productivity", status: "authored", cadence: "daily",   runs: 41, lastRun: "1h ago" },
  { name: "raw-to-wiki",       family: "productivity", status: "authored", cadence: "daily",   runs: 23, lastRun: "4h ago" },
  { name: "calendar-prep",     family: "productivity", status: "stub",     cadence: null,      runs: 0,  lastRun: "—" },
  { name: "lead-qual",         family: "business",     status: "stub",     cadence: null,      runs: 0,  lastRun: "—" },
  { name: "invoice-followup",  family: "business",     status: "stub",     cadence: null,      runs: 0,  lastRun: "—" },
];

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const PROJECTS: Project[] = [
  { slug: "agentic-os",  name: "Agentic OS",  dept: "infra",        active: true,  open: 21, color: "#4a8fd1" },
  { slug: "portfolio",   name: "Portfolio",   dept: "content",      active: true,  open: 4,  color: "#b388eb" },
  { slug: "fhir-rag",    name: "FHIR RAG",    dept: "research",     active: true,  open: 7,  color: "#4aa896" },
  { slug: "qml-essays",  name: "QML Essays",  dept: "content",      active: false, open: 0,  color: "#7fb4e8" },
];

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const ISSUES: Issue[] = [
  // ---------- DONE (6) ----------
  { id: "AOS-1",  title: "Bootstrap repo with skills/automations/vault layers",
    desc: "Scaffold the four-layer hierarchy: spec → architecture → memory → observability.",
    status: "done", priority: "high", dept: "infra", skill: null,
    assignee: "claude-lead", reporter: "tj", labels: ["scaffolding"], created: "Apr 28", updated: "Apr 30",
    cost: 0.42, tokensIn: 8200, tokensOut: 3100 },
  { id: "AOS-2",  title: "Wire dashboard to spawn `claude -p` headless via SSE",
    desc: "Stream tool-use deltas back to the OutputStream panel without buffering.",
    status: "done", priority: "high", dept: "coding", skill: "ts-refactor",
    assignee: "coder", reporter: "tj", labels: ["dashboard", "sse"], created: "May 1", updated: "May 4",
    cost: 1.14, tokensIn: 18400, tokensOut: 9220 },
  { id: "AOS-3",  title: "Vendor anthropics/skills skill-creator under skills/_meta/",
    desc: "Pull skill-creator @ commit pin; mirror SKILL.md unmodified.",
    status: "done", priority: "medium", dept: "research", skill: "skill-creator",
    assignee: "researcher", reporter: "tj", labels: ["meta"], created: "May 2", updated: "May 3",
    cost: 0.18, tokensIn: 3200, tokensOut: 900 },
  { id: "AOS-4",  title: "SQLite schema for runs, tasks, and agent ledger",
    desc: "Five tables: tasks, runs, agents, ledger, vault_index. WAL mode on.",
    status: "done", priority: "high", dept: "coding", skill: null,
    assignee: "coder", reporter: "tj", labels: ["db", "schema"], created: "May 5", updated: "May 8",
    cost: 0.72, tokensIn: 11200, tokensOut: 4400 },
  { id: "AOS-5",  title: "Five-column kanban wired to DB (backlog→done)",
    desc: "Single query, group in memory; sort by priority then created.",
    status: "done", priority: "medium", dept: "productivity", skill: null,
    assignee: "tj", reporter: "tj", labels: ["board"], created: "May 8", updated: "May 11",
    cost: 0, tokensIn: 0, tokensOut: 0 },
  { id: "AOS-6",  title: "Author standards/skill-authoring.md",
    desc: "Codify SKILL.md spec, allowed-tools rules, no-README-inside-skills convention.",
    status: "done", priority: "low", dept: "content", skill: "blog-draft",
    assignee: "writer", reporter: "tj", labels: ["docs", "standard"], created: "May 9", updated: "May 12",
    cost: 0.31, tokensIn: 5400, tokensOut: 2800 },

  // ---------- REVIEW (2) ----------
  { id: "AOS-7",  title: "Add lead:research agent with allowed-skills allowlist",
    desc: "Define agents/research/lead.md frontmatter; cap to lit-review, rag-eval, paper-summary.",
    status: "review", priority: "high", dept: "coding", skill: null,
    assignee: "coder", reporter: "tj", labels: ["agents"], created: "May 13", updated: "May 16",
    cost: 0.48, tokensIn: 7800, tokensOut: 3200 },
  { id: "AOS-8",  title: "Vault watcher: surface vault/raw/ changes in dashboard within 1s",
    desc: "chokidar on vault/, debounce 200ms, push SSE to VaultRecentCard.",
    status: "review", priority: "medium", dept: "coding", skill: "ts-refactor",
    assignee: "coder", reporter: "tj", labels: ["dashboard", "vault"], created: "May 14", updated: "May 17",
    cost: 0.61, tokensIn: 9100, tokensOut: 4100 },

  // ---------- RUNNING (3) ----------
  { id: "AOS-9",  title: "Author skills/research/lit-review SKILL.md with pretext citations",
    desc: "Spec-compliant SKILL.md driving arXiv search + abstract synthesis with anchored citations.",
    status: "running", priority: "high", dept: "research", skill: "skill-creator",
    assignee: "researcher", reporter: "tj", labels: ["skill", "citations"], created: "May 17", updated: "now",
    cost: 0.22, tokensIn: 4100, tokensOut: 1800, live: { tokensPerSec: 38, started: "4m ago", tool: "WebFetch" } },
  { id: "AOS-10", title: "Wire MCP servers for Linear and GitHub Projects",
    desc: "stdio MCP for both; rate-limit, cache, surface to skills via allowed-tools.",
    status: "running", priority: "urgent", dept: "coding", skill: "ts-refactor",
    assignee: "coder", reporter: "tj", labels: ["mcp", "integration"], created: "May 16", updated: "now",
    cost: 0.91, tokensIn: 14300, tokensOut: 6800, live: { tokensPerSec: 54, started: "12m ago", tool: "Bash" } },
  { id: "AOS-11", title: "Promote vault/raw/ inbox notes to vault/wiki/",
    desc: "Nightly skill that clusters raw notes by topic, drafts wiki entries, opens review PRs.",
    status: "running", priority: "medium", dept: "productivity", skill: "raw-to-wiki",
    assignee: "ops", reporter: "tj", labels: ["vault", "automation"], created: "May 17", updated: "now",
    cost: 0.34, tokensIn: 6200, tokensOut: 2800, live: { tokensPerSec: 22, started: "2m ago", tool: "Read" } },

  // ---------- QUEUED (5) ----------
  { id: "AOS-12", title: "Add token / cost ledger per agent run",
    desc: "Persist tokens_in, tokens_out, cost_usd per run; aggregate by agent and skill.",
    status: "queued", priority: "high", dept: "coding", skill: "ts-refactor",
    assignee: "coder", reporter: "tj", labels: ["telemetry"], created: "May 17", updated: "30m ago",
    cost: 0, tokensIn: 0, tokensOut: 0 },
  { id: "AOS-13", title: "Implement /new-skill slash command",
    desc: "Add .claude/commands/new-skill.md that delegates to skills/_meta/skill-creator/.",
    status: "queued", priority: "medium", dept: "coding", skill: null,
    assignee: "coder", reporter: "tj", labels: ["dx"], created: "May 16", updated: "1h ago",
    cost: 0, tokensIn: 0, tokensOut: 0 },
  { id: "AOS-14", title: "Generate weekly digest from vault/threads/",
    desc: "Saturday 9am: walk threads/, summarize, post to vault/outputs/digests/.",
    status: "queued", priority: "low", dept: "content", skill: "weekly-digest",
    assignee: "writer", reporter: "tj", labels: ["cadence:weekly"], created: "May 15", updated: "2h ago",
    cost: 0, tokensIn: 0, tokensOut: 0 },
  { id: "AOS-15", title: "Author skills/content/blog-draft SKILL.md",
    desc: "Outline → draft → revise pipeline; outputs to vault/outputs/blog/.",
    status: "queued", priority: "medium", dept: "content", skill: "skill-creator",
    assignee: "writer", reporter: "tj", labels: ["skill"], created: "May 15", updated: "3h ago",
    cost: 0, tokensIn: 0, tokensOut: 0 },
  { id: "AOS-16", title: "Add markdown lint to instructions/",
    desc: "markdownlint-cli2 with prose rules; CI step in dashboard's lint script.",
    status: "queued", priority: "low", dept: "productivity", skill: null,
    assignee: "ops", reporter: "tj", labels: ["lint"], created: "May 14", updated: "5h ago",
    cost: 0, tokensIn: 0, tokensOut: 0 },

  // ---------- BACKLOG (4) ----------
  { id: "AOS-17", title: "Evaluate Anthropic Messages Batches for nightly digests",
    desc: "Half-price, async; investigate fit for non-time-sensitive cadence skills.",
    status: "backlog", priority: "low", dept: "research", skill: null,
    assignee: null, reporter: "tj", labels: ["spike"], created: "May 12", updated: "May 12",
    cost: 0, tokensIn: 0, tokensOut: 0 },
  { id: "AOS-18", title: "Export run history to CSV from /api/runs",
    desc: "Streaming response; respect &since=&assignee= filters.",
    status: "backlog", priority: null, dept: "coding", skill: null,
    assignee: null, reporter: "tj", labels: ["export"], created: "May 10", updated: "May 10",
    cost: 0, tokensIn: 0, tokensOut: 0 },
  { id: "AOS-19", title: "Mobile-responsive board layout",
    desc: "Collapse to single-column with status filter; preserve add-card affordance.",
    status: "backlog", priority: "medium", dept: "productivity", skill: null,
    assignee: null, reporter: "tj", labels: ["responsive"], created: "May 9", updated: "May 9",
    cost: 0, tokensIn: 0, tokensOut: 0 },
  { id: "AOS-20", title: "Hook Substack publish into outputs/ pipeline",
    desc: "On merge of vault/outputs/blog/*.md, draft Substack post via API; require manual publish.",
    status: "backlog", priority: "low", dept: "content", skill: "substack-publish",
    assignee: null, reporter: "tj", labels: ["pipeline"], created: "May 8", updated: "May 8",
    cost: 0, tokensIn: 0, tokensOut: 0 },

  // ---------- FAILED (1) ----------
  { id: "AOS-21", title: "Auto-promote raw → wiki with LLM rewrite",
    desc: "Failed: confabulated three citations in test run; gating before retry.",
    status: "failed", priority: "medium", dept: "research", skill: "raw-to-wiki",
    assignee: "researcher", reporter: "tj", labels: ["bug", "halt"], created: "May 14", updated: "May 16",
    cost: 0.27, tokensIn: 4100, tokensOut: 1900,
    error: "Citation validator failed: 3/8 DOIs unresolved" },
];

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const RECENT_RUNS: RecentRun[] = [
  { id: "r-2941", skill: "lit-review",    agent: "researcher",  status: "running", duration: "4m 12s",  cost: 0.22, started: "4m ago",  issue: "AOS-9" },
  { id: "r-2940", skill: "ts-refactor",   agent: "coder",       status: "running", duration: "12m 4s",  cost: 0.91, started: "12m ago", issue: "AOS-10" },
  { id: "r-2939", skill: "raw-to-wiki",   agent: "ops",         status: "running", duration: "2m 8s",   cost: 0.34, started: "2m ago",  issue: "AOS-11" },
  { id: "r-2938", skill: "pr-review",     agent: "coder",       status: "done",    duration: "1m 44s",  cost: 0.18, started: "39m ago", issue: null },
  { id: "r-2937", skill: "inbox-triage",  agent: "ops",         status: "done",    duration: "0m 52s",  cost: 0.04, started: "1h ago",  issue: null },
  { id: "r-2936", skill: "ts-refactor",   agent: "coder",       status: "done",    duration: "3m 18s",  cost: 0.27, started: "1h ago",  issue: "AOS-2" },
  { id: "r-2935", skill: "skill-creator", agent: "researcher",  status: "done",    duration: "5m 02s",  cost: 0.46, started: "2h ago",  issue: null },
  { id: "r-2934", skill: "lit-review",    agent: "researcher",  status: "done",    duration: "8m 21s",  cost: 0.84, started: "2h ago",  issue: null },
];

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const VAULT_RECENT: VaultItem[] = [
  { path: "raw/2026-05-19-arxiv-fhir-rag.md",       kind: "raw",  changed: "4m ago" },
  { path: "wiki/mcp-server-patterns.md",            kind: "wiki", changed: "39m ago" },
  { path: "threads/2026-05-19-tj-router-design.md", kind: "thread", changed: "1h ago" },
  { path: "outputs/digests/2026-w20.md",            kind: "output", changed: "yest" },
  { path: "wiki/skill-authoring-checklist.md",      kind: "wiki", changed: "yest" },
];

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const ACTIVITY: Record<string, ActivityEntry[]> = {
  "AOS-10": [
    { kind: "create",   who: "tj",          when: "May 16 · 09:42", text: "filed this issue" },
    { kind: "comment",  who: "tj",          when: "May 16 · 09:43", text: "Linear MCP first; Projects can wait if it complicates auth." },
    { kind: "assign",   who: "tj",          when: "May 16 · 10:01", text: "assigned to coder" },
    { kind: "label",    who: "tj",          when: "May 16 · 10:01", text: "added labels mcp, integration" },
    { kind: "status",   who: "claude-lead", when: "May 16 · 10:14", text: "moved to Queued" },
    { kind: "run-start",who: "coder",       when: "May 17 · 08:21", text: "started run r-2934 · ts-refactor", run: "r-2934" },
    { kind: "tool",     who: "coder",       when: "May 17 · 08:22", text: "WebFetch · linear.app/docs/mcp" },
    { kind: "tool",     who: "coder",       when: "May 17 · 08:24", text: "Bash · npm install @linear/sdk" },
    { kind: "comment",  who: "coder",       when: "May 17 · 08:28", text: "Linear SDK is ESM-only; switching to MCP stdio so we don't bundle." },
    { kind: "status",   who: "coder",       when: "May 17 · 08:31", text: "moved to Running" },
    { kind: "run-tick", who: "coder",       when: "now",            text: "running · 12m 04s · $0.91 · 21k tokens" },
  ],
};

// Helpers
export const agentByHandle = (h: string | null): Agent | null =>
  h ? AGENTS.find((a) => a.handle === h) ?? null : null;

export const skillByName = (n: string | null): Skill | null =>
  n ? SKILLS.find((s) => s.name === n) ?? null : null;

export const deptOf = (d: string | null): Department | null =>
  d && d in DEPARTMENTS ? DEPARTMENTS[d as DeptKey] : null;

export const issuesInCol = (key: ColumnDef["key"]): Issue[] => {
  if (key === "queued") return ISSUES.filter((i) => i.status === "queued" || i.status === "claimed");
  return ISSUES.filter((i) => i.status === key);
};

export const failedIssues = (): Issue[] => ISSUES.filter((i) => i.status === "failed");

export const sumCost = (issues: Issue[]): number =>
  issues.reduce((s, i) => s + (i.cost || 0), 0);

export const defaultActivity = (issue: Issue): ActivityEntry[] => {
  const out: ActivityEntry[] = [
    { kind: "create", who: issue.reporter, when: issue.created, text: "filed this issue" },
  ];
  if (issue.assignee) {
    out.push({
      kind: "assign",
      who: issue.reporter,
      when: issue.created,
      text: `assigned to @${issue.assignee}`,
    });
  }
  out.push({
    kind: "status",
    who: issue.assignee || issue.reporter,
    when: issue.updated,
    text: `moved to ${issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}`,
  });
  return out;
};

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const AGENT_BLURB: Record<string, string> = {
  "claude-lead": "Top-level router. Triages incoming issues and assigns them to the right department lead.",
  researcher:    "arXiv crawls, paper summaries, RAG evaluations. Anchored citations only.",
  coder:         "TypeScript refactors, PR reviews, MCP server wiring, test scaffolding.",
  writer:        "Blog drafts, weekly digests, Substack handoff. Reads like an engineer, not marketing.",
  ops:           "Vault hygiene · inbox triage · raw→wiki promotions · calendar prep.",
  analyst:       "Lead qualification · invoice follow-ups · billable-hours pulls (stub).",
};

/** @deprecated Use lib/design/loaders.ts; will be removed in Phase 9.7 */
export const AGENT_SKILLS: Record<string, string[]> = {
  "claude-lead": ["skill-creator"],
  researcher:    ["lit-review", "rag-eval", "paper-summary"],
  coder:         ["ts-refactor", "pr-review", "test-author"],
  writer:        ["blog-draft", "weekly-digest", "substack-publish"],
  ops:           ["inbox-triage", "raw-to-wiki", "calendar-prep"],
  analyst:       ["lead-qual", "invoice-followup"],
};
