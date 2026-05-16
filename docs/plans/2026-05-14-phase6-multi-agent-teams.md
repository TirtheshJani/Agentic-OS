# Phase 6 — Multi-Agent Teams Implementation Plan

> **For agentic workers:** Use `_meta/executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Validate with `cd dashboard && npm run lint && npm run validate:skills && npm run validate:automations && npm run validate:agents` after each sub-phase. Smoke-test visual changes via `cd dashboard && npm run dev`.

**Goal:** Graft a teams-as-departments model onto the existing branch structure: agent profiles per department, a SQLite task lifecycle, an assignee picker in the workbench, lead-routing skills that claim and reassign, cross-agent handoffs via a streaming event, and per-task threads in the vault.

**Architecture:** Six sub-phases ship independently and in order (6.1 → 6.6). Each adds at most one new file in `dashboard/lib/`, one new validator, and a small UI surface. SQLite stays the system of record; the vault holds threads as plain markdown. No Postgres, no Go daemon, no new runtime — just `claude -p` spawning, SSE streaming, and a new `tasks` table.

**Tech Stack:** Next.js 16 App Router, React 19, better-sqlite3 (WAL), shadcn/ui primitives, gray-matter, cron-parser. No new dependencies.

---

## Locked decisions (from pre-plan conversation, 2026-05-14)

These were resolved with TJ before drafting. Tasks below assume these values; do not re-litigate.

1. **Lead skill names use `<dept>-lead`** (`research-lead`, `coding-lead`, etc). The roadmap's `<dept>/lead` shorthand collides with the validator's `slug == name` rule. Five leads ship: `research-lead`, `coding-lead`, `content-lead`, `business-lead`, `productivity-lead`. **No `_meta-lead`** — `_meta` skills are framework-level and not task-routable, and `_meta` is not kebab-case anyway.
2. **Lead loop is a manual `Tick` button**, not cron. Skips authoring `automations/remote/<dept>-lead-tick.md`. The Team rail in 6.4 grows a per-department Tick button that POSTs to `/api/lead/tick`.
3. **`allowed-skills` on an agent profile is advisory** — injected into the system prompt the lead writes for the member, no runtime gate. Matches how `metadata.agent` works today.
4. **Thread writes go through the Write tool on the model side**, not a new event type. The orchestrator sets `AGENTIC_OS_THREAD_PATH` in the spawned `claude -p` env. The model uses Write to append. No new MCP server, no new SSE event type. Lead skills include thread-write instructions in their bodies.
5. **System prompt seed is injected with `--append-system-prompt`**, not `--system-prompt`. Preserves Claude Code defaults; lead-written prompts stack on top.
6. **Handoff opt-in (`metadata.handoff: true`) is checked on the parent skill** (the one emitting the `next-task` event). Accidental emissions from skills that did not opt in are dropped with a warning logged to the run record.
7. **Plan storage**: this file lives at `docs/plans/2026-05-14-phase6-multi-agent-teams.md`, matching the existing `docs/plans/2026-05-10-dashboard-polish.md`.
8. **No new test framework.** Verification scripts go under `dashboard/scripts/test-*.mjs` and run against a temp SQLite DB. Wired to `npm run test:tasks`, `npm run test:threads`, etc.

---

## Important precondition — read first

`dashboard/AGENTS.md` warns: "This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing code." This plan touches:

- New dynamic route segments (`app/api/tasks/[id]/...`) — confirm parameter typing convention in `node_modules/next/dist/docs/02-app/01-getting-started/03-fetching-data.mdx` (or whichever is current) before writing the first route in 6.2.
- New page route (`app/tasks/[id]/page.tsx`) in 6.6 — confirm Server-vs-Client component split.
- Env var passthrough in `lib/claude-headless.ts` — no Next-specific concerns; standard `child_process.spawn`.

If a step trips on a Next 16 quirk, the AGENTS.md note tells you which docs to consult.

---

## File structure

### New files (in order of creation)

**6.1 — Agent profiles**
- `agents/research/lead.md` — `research-lead` profile (role: lead)
- `agents/research/arxiv-watcher.md` — example member profile
- `agents/coding/lead.md`
- `agents/content/lead.md`
- `agents/business/lead.md`
- `agents/productivity/lead.md`
- `agents/_prompts/research-lead.md` — seed system prompt for the lead
- `agents/_prompts/coding-lead.md`
- `agents/_prompts/content-lead.md`
- `agents/_prompts/business-lead.md`
- `agents/_prompts/productivity-lead.md`
- `agents/_prompts/arxiv-watcher.md`
- `dashboard/lib/agents-loader.ts` — mirrors `skills-loader.ts`
- `dashboard/scripts/validate-agents.mjs` — frontmatter + one-lead-per-dept check
- `dashboard/components/team-rail.tsx` — right-aside card listing agents grouped by department

**6.2 — Task lifecycle**
- `dashboard/lib/tasks.ts` — CRUD helpers (createTask, claimTask, startTask, finishTask, listTasks, getTask, linkRunToTask)
- `dashboard/app/api/tasks/route.ts` — POST = create, GET = list with filters
- `dashboard/app/api/tasks/[id]/route.ts` — GET single task
- `dashboard/app/api/tasks/[id]/claim/route.ts` — POST claim
- `dashboard/app/api/tasks/[id]/start/route.ts` — POST start
- `dashboard/app/api/tasks/[id]/finish/route.ts` — POST finish
- `dashboard/scripts/test-tasks.mjs` — temp-DB round-trip lifecycle

**6.3 — Assignee picker**
- (Modifications only — see "Modified" list)

**6.4 — Lead routing skills**
- `skills/research/research-lead/SKILL.md`
- `skills/coding/coding-lead/SKILL.md`
- `skills/content/content-lead/SKILL.md`
- `skills/business/business-lead/SKILL.md`
- `skills/productivity/productivity-lead/SKILL.md`
- `dashboard/app/api/lead/tick/route.ts` — POST `{department}` → spawn the lead

**6.5 — Cross-agent handoff**
- `dashboard/app/api/tasks/[id]/chain/route.ts` — GET parent → children chain
- `dashboard/components/task-chain.tsx` — renders the chain

**6.6 — Task thread**
- `vault/threads/.gitkeep` — folder marker
- `dashboard/app/api/threads/[id]/route.ts` — GET thread, POST user comment
- `dashboard/components/task-thread.tsx` — renders thread, append textarea
- `dashboard/app/tasks/[id]/page.tsx` — task detail page (chain + thread)
- `dashboard/scripts/test-threads.mjs` — append round-trip

### Modified files

- `dashboard/package.json` — add `validate:agents`, `test:tasks`, `test:threads` scripts
- `dashboard/lib/paths.ts` — add `agentsPath`, `agentPromptsPath`, `threadsPath`
- `dashboard/lib/db.ts` — add `tasks` table migration; add nullable `task_id` column to `runs`
- `dashboard/lib/claude-headless.ts` — accept `appendSystemPrompt`, `extraEnv`; parse `next-task` JSON events
- `dashboard/lib/skills-loader.ts` — expose `metadata.handoff` on `Skill`
- `dashboard/app/api/run/route.ts` — accept `taskId`, `assignee`; forward env vars; emit handoff → POST `/api/tasks`
- `dashboard/components/prompt-panel.tsx` — Assign-to control
- `dashboard/components/workbench.tsx` — assignee state; enqueue vs immediate-run branch
- `dashboard/app/page.tsx` — load agents; render TeamRail
- `dashboard/components/team-rail.tsx` (6.4 modification) — add Tick button per department

### Untouched

- `vault/CLAUDE.md`, `product/*`, `standards/*`, `instructions/*` — narrative changes (if any) handled in a follow-up commit, not in this plan
- `dashboard/lib/{analytics,mcp-loader,branches,projects-loader,vault-watcher,run-guards,schedules}.ts` — no signature changes needed

---

# Sub-phase 6.1 — Agent profiles

Roadmap reference: `product/roadmap.md:58-70`.

## Task 6.1.1 — Add `agents/` paths to `lib/paths.ts`

**Files:**
- Modify: `dashboard/lib/paths.ts`

- [ ] **Step 1: Add paths**

Edit `dashboard/lib/paths.ts` to add three exports below the existing ones:

```ts
import path from "node:path";

export const repoRoot = path.resolve(process.cwd(), "..");
export const skillsPath = path.join(repoRoot, "skills");
export const vaultPath = process.env.VAULT_PATH
  ? path.resolve(repoRoot, process.env.VAULT_PATH)
  : path.join(repoRoot, "vault");
export const automationsRemotePath = path.join(repoRoot, "automations", "remote");
export const dbPath = process.env.AGENTIC_OS_DB
  ? path.resolve(repoRoot, process.env.AGENTIC_OS_DB)
  : path.join(repoRoot, ".agentic-os", "state.db");
export const agentsPath = path.join(repoRoot, "agents");
export const agentPromptsPath = path.join(agentsPath, "_prompts");
export const threadsPath = path.join(vaultPath, "threads");

export function normalizeCwd(p: string): string {
  return path.resolve(p).toLowerCase();
}
```

- [ ] **Step 2: Type-check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/paths.ts
git commit -m "phase6.1: add agents and threads paths"
```

## Task 6.1.2 — Author the agents-loader

**Files:**
- Create: `dashboard/lib/agents-loader.ts`

Mirrors `dashboard/lib/skills-loader.ts:1-90`. Flat frontmatter (no `metadata` sub-object). Returns agents sorted by department then name.

- [ ] **Step 1: Create `dashboard/lib/agents-loader.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { agentsPath } from "./paths";

export type AgentRole = "lead" | "member";

export type AgentFrontmatter = {
  name: string;
  description?: string;
  model?: string;
  department: string;
  role: AgentRole;
  "allowed-skills"?: string[];
  "allowed-tools"?: string;
  "system-prompt"?: string;
};

export type Agent = {
  name: string;
  description: string;
  model: string;
  department: string;
  role: AgentRole;
  allowedSkills: string[];
  allowedTools: string | null;
  systemPromptPath: string | null;
  folder: string;
};

const DEPARTMENTS = [
  "research",
  "coding",
  "content",
  "business",
  "productivity",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export function isDepartment(s: string): s is Department {
  return (DEPARTMENTS as readonly string[]).includes(s);
}

export const DEPARTMENT_ORDER: Department[] = [...DEPARTMENTS];

function walkAgentMd(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "_prompts") {
      walkAgentMd(full, acc);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      acc.push(full);
    }
  }
  return acc;
}

export function loadAgents(): Agent[] {
  const files = walkAgentMd(agentsPath);
  const agents: Agent[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const fm = matter(raw).data as AgentFrontmatter;
    if (!fm.name || !fm.department || !fm.role) continue;
    const folder = path.relative(agentsPath, path.dirname(file));
    agents.push({
      name: fm.name,
      description: fm.description ?? "",
      model: fm.model ?? "opus",
      department: fm.department,
      role: fm.role,
      allowedSkills: Array.isArray(fm["allowed-skills"]) ? fm["allowed-skills"] : [],
      allowedTools: typeof fm["allowed-tools"] === "string" ? fm["allowed-tools"] : null,
      systemPromptPath: typeof fm["system-prompt"] === "string" ? fm["system-prompt"] : null,
      folder,
    });
  }
  return agents.sort((a, b) => {
    const aOrder = DEPARTMENT_ORDER.indexOf(a.department as Department);
    const bOrder = DEPARTMENT_ORDER.indexOf(b.department as Department);
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.role !== b.role) return a.role === "lead" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function agentsByDepartment(agents: Agent[]): Map<string, Agent[]> {
  const map = new Map<string, Agent[]>();
  for (const dept of DEPARTMENT_ORDER) map.set(dept, []);
  for (const a of agents) {
    if (!map.has(a.department)) map.set(a.department, []);
    map.get(a.department)!.push(a);
  }
  return map;
}

export function leadFor(department: string, agents: Agent[]): Agent | null {
  return agents.find((a) => a.department === department && a.role === "lead") ?? null;
}
```

- [ ] **Step 2: Type-check** — `cd dashboard && npx tsc --noEmit`. No errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/agents-loader.ts
git commit -m "phase6.1: agents-loader mirrors skills-loader"
```

## Task 6.1.3 — Author the agent validator

**Files:**
- Create: `dashboard/scripts/validate-agents.mjs`
- Modify: `dashboard/package.json`

Asserts: kebab-case names, name matches filename stem, department is one of the five, role is lead/member, exactly one lead per active department, `allowed-skills` references existing skills, `system-prompt` points to an existing file.

- [ ] **Step 1: Create `dashboard/scripts/validate-agents.mjs`**

```js
#!/usr/bin/env node
// Validate every agents/**/*.md profile.
// Exits non-zero on any violation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const agentsRoot = path.join(repoRoot, "agents");
const skillsRoot = path.join(repoRoot, "skills");

const DEPARTMENTS = new Set([
  "research",
  "coding",
  "content",
  "business",
  "productivity",
]);

const ALLOWED_TOP_LEVEL = new Set([
  "name",
  "description",
  "model",
  "department",
  "role",
  "allowed-skills",
  "allowed-tools",
  "system-prompt",
]);

function walkAgents(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "_prompts") continue;
      walkAgents(full, out);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function collectSkillNames() {
  const names = new Set();
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name === "SKILL.md") {
        const raw = fs.readFileSync(full, "utf8");
        const fm = matter(raw).data;
        if (typeof fm.name === "string") names.add(fm.name);
      }
    }
  }
  walk(skillsRoot);
  return names;
}

function validate(file, skillNames) {
  const errs = [];
  const stem = path.basename(file, ".md");
  const raw = fs.readFileSync(file, "utf8");
  const fm = matter(raw).data;

  for (const key of Object.keys(fm)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) {
      errs.push(`invalid top-level key "${key}" (allowed: ${[...ALLOWED_TOP_LEVEL].join(", ")})`);
    }
  }

  if (!fm.name) errs.push("name: required");
  if (!fm.department) errs.push("department: required");
  if (!fm.role) errs.push("role: required");

  if (typeof fm.name === "string") {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(fm.name)) {
      errs.push(`name: must be kebab-case (got "${fm.name}")`);
    }
    if (stem !== fm.name) {
      errs.push(`name "${fm.name}" must match filename stem "${stem}"`);
    }
  }

  if (typeof fm.department === "string" && !DEPARTMENTS.has(fm.department)) {
    errs.push(`department: "${fm.department}" not in (${[...DEPARTMENTS].join(", ")})`);
  }

  if (fm.role !== "lead" && fm.role !== "member") {
    errs.push(`role: must be "lead" or "member" (got "${fm.role}")`);
  }

  if (Array.isArray(fm["allowed-skills"])) {
    for (const s of fm["allowed-skills"]) {
      if (typeof s !== "string") {
        errs.push(`allowed-skills: every entry must be a string`);
        continue;
      }
      if (!skillNames.has(s)) {
        errs.push(`allowed-skills: "${s}" not found in skills/**/SKILL.md`);
      }
    }
  }

  if (typeof fm["system-prompt"] === "string") {
    const promptPath = path.resolve(path.dirname(file), fm["system-prompt"]);
    if (!fs.existsSync(promptPath)) {
      errs.push(`system-prompt: file does not exist (${fm["system-prompt"]})`);
    }
  }

  return errs;
}

function main() {
  if (!fs.existsSync(agentsRoot)) {
    console.error(`FAIL  agents/ directory does not exist at ${agentsRoot}`);
    process.exit(1);
  }
  const skillNames = collectSkillNames();
  const files = walkAgents(agentsRoot);
  const byDept = new Map();
  let bad = 0;

  for (const f of files) {
    const errs = validate(f, skillNames);
    const rel = path.relative(repoRoot, f);
    if (errs.length === 0) {
      console.log(`OK    ${rel}`);
    } else {
      bad++;
      console.error(`FAIL  ${rel}`);
      for (const e of errs) console.error(`        - ${e}`);
    }
    const fm = matter(fs.readFileSync(f, "utf8")).data;
    if (fm.department && fm.role === "lead") {
      const list = byDept.get(fm.department) ?? [];
      list.push(rel);
      byDept.set(fm.department, list);
    }
  }

  for (const [dept, leads] of byDept) {
    if (leads.length > 1) {
      bad++;
      console.error(`FAIL  department "${dept}" has ${leads.length} leads:`);
      for (const lead of leads) console.error(`        - ${lead}`);
    }
  }

  console.log(`\n${files.length} agent(s) checked, ${bad} failed.`);
  process.exit(bad === 0 ? 0 : 1);
}

main();
```

- [ ] **Step 2: Add `validate:agents` script to `dashboard/package.json`**

In the `"scripts"` block, add the line:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "validate:skills": "node scripts/validate-skills.mjs",
    "validate:automations": "node scripts/validate-automations.mjs",
    "validate:agents": "node scripts/validate-agents.mjs"
  }
}
```

(Preserve the rest of the file exactly; this snippet shows the scripts section only.)

- [ ] **Step 3: Run the validator against an empty agents/ dir**

Run: `mkdir -p agents && cd dashboard && npm run validate:agents`
Expected: `0 agent(s) checked, 0 failed.` and exit 0.

- [ ] **Step 4: Commit**

```bash
git add dashboard/scripts/validate-agents.mjs dashboard/package.json
mkdir -p agents
touch agents/.gitkeep
git add agents/.gitkeep
git commit -m "phase6.1: agents validator + agents/ folder"
```

## Task 6.1.4 — Write the five lead agent profiles

**Files:**
- Create: `agents/research/lead.md`
- Create: `agents/coding/lead.md`
- Create: `agents/content/lead.md`
- Create: `agents/business/lead.md`
- Create: `agents/productivity/lead.md`

The folder name (`research/`, `coding/`, etc.) is informational. The filename stem must match the agent's `name` field. So `agents/research/lead.md` would fail validation (stem `lead` != name `research-lead`). Use `research-lead.md` etc.

**Correction:** filenames are `agents/<department>/<agent-name>.md`. The actual paths are:

- `agents/research/research-lead.md`
- `agents/coding/coding-lead.md`
- `agents/content/content-lead.md`
- `agents/business/business-lead.md`
- `agents/productivity/productivity-lead.md`

- [ ] **Step 1: Create `agents/research/research-lead.md`**

```markdown
---
name: research-lead
description: Routes research tasks to the right teammate based on skill overlap. Lead of the research department.
model: opus
department: research
role: lead
allowed-skills:
  - research-lead
  - paper-search
  - literature-review
  - deep-web-research
allowed-tools: "Read Write Glob Grep WebFetch WebSearch"
system-prompt: ../_prompts/research-lead.md
---

# Research lead

This agent's behavior is defined by the linked system prompt. The skill body lives in
`skills/research/research-lead/SKILL.md` — this profile only configures the
spawning context (model, skill allowlist, tool grants).
```

- [ ] **Step 2: Create `agents/coding/coding-lead.md`**

```markdown
---
name: coding-lead
description: Routes coding tasks (PRs, repo work, debugging) to the right teammate. Lead of the coding department.
model: opus
department: coding
role: lead
allowed-skills:
  - coding-lead
  - pr-review-prep
  - issue-triage
  - repo-onboarding
allowed-tools: "Read Write Edit Glob Grep Bash"
system-prompt: ../_prompts/coding-lead.md
---

# Coding lead
```

- [ ] **Step 3: Create `agents/content/content-lead.md`**

```markdown
---
name: content-lead
description: Routes writing tasks (Substack drafts, newsletter, community comments). Lead of the content department.
model: opus
department: content
role: lead
allowed-skills:
  - content-lead
  - avoid-ai-writing
  - draft-from-vault
  - substack-publish-prep
allowed-tools: "Read Write Edit Glob Grep"
system-prompt: ../_prompts/content-lead.md
---

# Content lead
```

- [ ] **Step 4: Create `agents/business/business-lead.md`**

```markdown
---
name: business-lead
description: Routes venture-side tasks (proposals, invoices, P&L). Lead of the business department.
model: opus
department: business
role: lead
allowed-skills:
  - business-lead
allowed-tools: "Read Write Glob Grep"
system-prompt: ../_prompts/business-lead.md
---

# Business lead

Note: no member agents exist yet. Lead will hold tasks in queue until members are authored.
```

- [ ] **Step 5: Create `agents/productivity/productivity-lead.md`**

```markdown
---
name: productivity-lead
description: Routes daily-ops tasks (inbox triage, calendar prep, rollups). Lead of the productivity department.
model: opus
department: productivity
role: lead
allowed-skills:
  - productivity-lead
  - inbox-triage
  - daily-rollup
  - vault-cleanup
allowed-tools: "Read Write Glob Grep"
system-prompt: ../_prompts/productivity-lead.md
---

# Productivity lead
```

- [ ] **Step 6: Run the validator**

Run: `cd dashboard && npm run validate:agents`
Expected: 5 OK lines, exit 0. **FAILS** until 6.1.5 creates the prompt seed files. That's fine — validate after 6.1.5.

- [ ] **Step 7: Commit (deferred to 6.1.5)** — commit profiles + prompts together since each profile references a prompt path.

## Task 6.1.5 — Write the lead system-prompt seeds

**Files:**
- Create: `agents/_prompts/research-lead.md`
- Create: `agents/_prompts/coding-lead.md`
- Create: `agents/_prompts/content-lead.md`
- Create: `agents/_prompts/business-lead.md`
- Create: `agents/_prompts/productivity-lead.md`

These get injected via `--append-system-prompt` when the lead is spawned. They tell the lead what to do: read the department queue, pick a teammate, hand off.

- [ ] **Step 1: Create `agents/_prompts/research-lead.md`**

```markdown
You are the research-lead. Your job is to route tasks queued for the
research department to the right teammate.

On each tick, the Tick button POSTs to /api/lead/tick which spawns you
with this prompt appended to your system prompt. You receive the queue
contents inline in the user message.

For each pending task assigned to lead:research:
  1. Read the task prompt.
  2. Pick the teammate whose allowed-skills overlap best with what the
     task asks for.
  3. POST to /api/tasks/:id/claim with body { assignee: "<teammate>" }.
  4. Append a one-line decision note to the task's thread file at
     vault/threads/<task-id>.md explaining your choice. You handle many
     tasks per tick, so construct the path explicitly per task — do not
     rely on $AGENTIC_OS_THREAD_PATH (that env var is only set when a
     single-task run is spawned via /api/run, not /api/lead/tick).

Available teammates (allowed-skills in parens):
  - arxiv-watcher (paper-search, arxiv-daily-digest, literature-review)
  - (more will be authored over time — check /api/tasks endpoint when needed)

If no teammate fits, leave the task queued and append a note to the
thread saying "no match found, holding". Do not invent teammates.

Stop after processing the queue. Do not spawn the teammates yourself;
the workbench will start them when TJ confirms or via a follow-up Tick.
```

- [ ] **Step 2: Create `agents/_prompts/coding-lead.md`**

```markdown
You are the coding-lead. Route tasks queued for the coding department.

On each tick: read pending tasks assigned to lead:coding, pick a
teammate, POST claim, append a note to the thread.

Available teammates (none yet — author members under
agents/coding/ as the workload grows). For now, your job is to:
  1. Confirm each queued task is in scope for coding.
  2. Append a note saying "no teammate authored, holding" if none exists.
  3. Do not reassign back to user without explicit instruction.

Hold the queue cleanly. The dashboard surfaces queue depth so TJ knows
when to author the next member.
```

- [ ] **Step 3: Create `agents/_prompts/content-lead.md`**

```markdown
You are the content-lead. Route writing tasks (Substack, newsletter,
community comments) to the right teammate.

On each tick: read pending tasks assigned to lead:content, pick a
teammate, POST claim, append a thread note.

Available teammates (none yet authored under agents/content/). Hold the
queue with thread notes until members are added.
```

- [ ] **Step 4: Create `agents/_prompts/business-lead.md`**

```markdown
You are the business-lead. Route venture-side tasks (proposals,
invoices, P&L tracking) to the right teammate.

Available teammates: none yet. Your job is to triage incoming tasks,
append a thread note describing the work needed, and hold the queue
until business members are authored.
```

- [ ] **Step 5: Create `agents/_prompts/productivity-lead.md`**

```markdown
You are the productivity-lead. Route daily-ops tasks (inbox triage,
calendar prep, rollups) to the right teammate.

On each tick: read pending tasks assigned to lead:productivity, pick a
teammate, POST claim, append a thread note explaining the choice.

Available teammates: none yet authored as a separate agent (the existing
inbox-triage, daily-rollup, vault-cleanup skills run as TJ's tools, not
as separate agents). When a task lands here, append a note saying
"running directly via skill, no agent indirection needed" and claim it
for assignee:user.
```

- [ ] **Step 6: Run the validator and commit**

Run: `cd dashboard && npm run validate:agents`
Expected: 5 OK lines, exit 0.

```bash
git add agents/
git commit -m "phase6.1: five lead profiles + seed prompts"
```

## Task 6.1.6 — Author one member profile (arxiv-watcher)

**Files:**
- Create: `agents/research/arxiv-watcher.md`
- Create: `agents/_prompts/arxiv-watcher.md`

Member to prove the lead → member handoff. The roadmap exit criteria mentions arxiv-watcher specifically.

- [ ] **Step 1: Create `agents/research/arxiv-watcher.md`**

```markdown
---
name: arxiv-watcher
description: Pulls arXiv daily for ML and physics-ML papers matching a query, writes a digest to the vault.
model: sonnet
department: research
role: member
allowed-skills:
  - arxiv-daily-digest
  - paper-search
allowed-tools: "Read Write WebFetch WebSearch"
system-prompt: ../_prompts/arxiv-watcher.md
---

# Arxiv watcher (research member)
```

Note: this references `arxiv-daily-digest` and `paper-search` which may not exist as authored skills yet. The validator will fail until they do. Two options handled inline:

- If `paper-search` exists as an `_meta/paper-search` skill (per the available-skills list in conversation), it's fine.
- If `arxiv-daily-digest` is only a stub, that's still fine — the validator only checks the name is in the skill set, not that status is `authored`.

If the validator fails with `allowed-skills: "arxiv-daily-digest" not found`, remove that line from the profile's `allowed-skills` and replace with the closest authored skill name (e.g., `paper-search` alone). Do not invent skill names.

- [ ] **Step 2: Create `agents/_prompts/arxiv-watcher.md`**

```markdown
You are arxiv-watcher, a research-department member.

When the research-lead claims a task for you, your job is to:
  1. Read the task prompt to extract the query (categories, keywords,
     date range).
  2. Use the paper-search skill (and arxiv-daily-digest if available)
     to pull matching papers from the last 24 hours by default.
  3. Write a digest to vault/raw/daily/<YYYY-MM-DD>-arxiv-<topic>.md
     with one bullet per paper: title, authors, abstract first sentence,
     arXiv ID, DOI if present.
  4. Append a one-line note to the task thread at
     $AGENTIC_OS_THREAD_PATH summarizing what you did.
  5. POST to /api/tasks/:id/finish with status=done and the digest path.

If you need to hand off (e.g. the task asks for a Substack draft from
the digest), emit a next-task event on a single line of stdout:

  next-task: {"assignee":"content-lead","prompt":"Draft Substack section from <path>","parent_task_id":<id>}

The orchestrator parses this and enqueues a new task with parent_task_id
set. Only emit next-task if metadata.handoff:true is set in your skill's
SKILL.md frontmatter — otherwise the event is dropped.
```

- [ ] **Step 3: Validate**

Run: `cd dashboard && npm run validate:agents`
Expected: 6 OK lines, exit 0. If any `allowed-skills` entry fails, edit the profile to remove unauthored skill names.

- [ ] **Step 4: Commit**

```bash
git add agents/research/arxiv-watcher.md agents/_prompts/arxiv-watcher.md
git commit -m "phase6.1: arxiv-watcher member profile"
```

## Task 6.1.7 — Team rail component

**Files:**
- Create: `dashboard/components/team-rail.tsx`
- Modify: `dashboard/app/page.tsx`

Renders agents grouped by department in the right aside, using the existing `SectionHeader` + `Pill` + `StatusDot` primitives from the dashboard polish plan. Reads via `loadAgents()` server-side.

- [ ] **Step 1: Create `dashboard/components/team-rail.tsx`**

```tsx
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import {
  DEPARTMENT_ORDER,
  agentsByDepartment,
  type Agent,
} from "@/lib/agents-loader";

export function TeamRail({ agents }: { agents: Agent[] }) {
  const byDept = agentsByDepartment(agents);
  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="TEAM" meta={<Pill tone="muted">{agents.length}</Pill>} />
      {agents.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          No agents. Author profiles under <span className="font-mono">agents/</span>.
        </div>
      )}
      <div className="space-y-2 mt-1">
        {DEPARTMENT_ORDER.map((dept) => {
          const list = byDept.get(dept) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={dept}>
              <div className="mono-label text-muted-foreground px-1 py-0.5 uppercase">
                {dept}
              </div>
              <ul className="space-y-0.5">
                {list.map((a) => (
                  <li key={a.name} className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="truncate" title={a.description}>{a.name}</span>
                    <Pill tone={a.role === "lead" ? "good" : "muted"}>
                      {a.role.toUpperCase()}
                    </Pill>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify `dashboard/app/page.tsx`** — load agents and render the rail

Replace the existing imports and `Page()` body with:

```tsx
import { ForecastCard } from "@/components/forecast-card";
import { Header } from "@/components/header";
import { IntegrationsStrip } from "@/components/integrations-strip";
import { RecentRunsCard } from "@/components/recent-runs-card";
import { RunStateProvider } from "@/components/run-state";
import { Starfield } from "@/components/starfield";
import { TeamRail } from "@/components/team-rail";
import { UsageCard } from "@/components/usage-card";
import { VaultRecentCard } from "@/components/vault-recent-card";
import { VaultSearchCard } from "@/components/vault-search-card";
import { Workbench } from "@/components/workbench";
import { loadAgents } from "@/lib/agents-loader";
import { loadProjects } from "@/lib/projects-loader";
import { loadSkills } from "@/lib/skills-loader";

export const dynamic = "force-dynamic";

export default function Page() {
  const skills = loadSkills();
  const projects = loadProjects();
  const agents = loadAgents();
  return (
    <>
      <Starfield />
      <RunStateProvider>
        <Header />
        <main className="grid grid-cols-[280px_1fr_320px] gap-3 p-3 min-h-[calc(100dvh-3rem)]">
          <Workbench skills={skills} projects={projects} />
          <aside className="space-y-3 overflow-y-auto">
            <UsageCard />
            <IntegrationsStrip />
            <TeamRail agents={agents} />
            <RecentRunsCard />
            <VaultRecentCard />
            <VaultSearchCard />
            <ForecastCard />
          </aside>
        </main>
      </RunStateProvider>
    </>
  );
}
```

- [ ] **Step 3: Smoke-test in browser**

Run: `cd dashboard && npm run dev`
Expected: open `http://localhost:3000`. The right aside contains a new "TEAM" card listing five LEAD agents grouped by department, plus the `arxiv-watcher` MEMBER under research.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/team-rail.tsx dashboard/app/page.tsx
git commit -m "phase6.1: team rail in dashboard aside"
```

## 6.1 exit criteria

Confirm all before moving to 6.2:

- [ ] `npm run validate:agents` exits 0 with 6 OK lines.
- [ ] Five lead profiles exist, one per active department (research, coding, content, business, productivity).
- [ ] One member profile exists (`arxiv-watcher` in research).
- [ ] Dashboard "TEAM" card renders the agents grouped by department with LEAD/MEMBER pills.
- [ ] No agent files reference a system-prompt path that doesn't exist.
- [ ] `dashboard/lib/agents-loader.ts` and `dashboard/scripts/validate-agents.mjs` exist and are exercised by `npm run validate:agents`.

---

# Sub-phase 6.2 — Task lifecycle in SQLite

Roadmap reference: `product/roadmap.md:73-86`.

## Task 6.2.1 — DB schema: tasks table + runs.task_id

**Files:**
- Modify: `dashboard/lib/db.ts`

Add the `tasks` table to `migrate()` and a nullable `task_id` column to `runs`.

- [ ] **Step 1: Edit `dashboard/lib/db.ts:19-60`** — extend `migrate()`

Inside `migrate(db)`, after the existing `CREATE TABLE IF NOT EXISTS schedules` block but **before** the `addColumnIfMissing` calls, add the tasks table:

```ts
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      assignee TEXT NOT NULL,
      department TEXT,
      parent_task_id INTEGER REFERENCES tasks(id),
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      run_id INTEGER REFERENCES runs(id),
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, assignee);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
  `);
```

Then append to the existing `addColumnIfMissing(...)` series at the end of `migrate()`:

```ts
  addColumnIfMissing(db, "runs", "task_id", "INTEGER REFERENCES tasks(id)");
```

- [ ] **Step 2: Add the TaskRow type** — append to the bottom of `dashboard/lib/db.ts`

```ts
export type TaskStatus = "queued" | "claimed" | "running" | "done" | "failed";

export type TaskRow = {
  id: number;
  prompt: string;
  assignee: string;
  department: string | null;
  parent_task_id: number | null;
  status: TaskStatus;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  run_id: number | null;
  error: string | null;
};
```

Also add `task_id` to the existing `RunRow` type (in the same file, line ~75-94):

```ts
export type RunRow = {
  id: number;
  skill_slug: string;
  prompt: string;
  status: "queued" | "running" | "done" | "error";
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  output_path: string | null;
  error: string | null;
  project_slug: string | null;
  cwd: string | null;
  agent: string | null;
  mcp_server: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_cache_read: number | null;
  tokens_cache_create: number | null;
  cost_usd: number | null;
  task_id: number | null;
};
```

- [ ] **Step 3: Migrate a fresh DB** — verify migration is clean

Delete the dev DB and let the dashboard recreate it:

```bash
rm -f .agentic-os/state.db
cd dashboard && npx tsc --noEmit
```

Expected: type-check passes, no errors. Migration runs on next dashboard launch (handled in 6.2.3).

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/db.ts
git commit -m "phase6.2: tasks table + runs.task_id migration"
```

## Task 6.2.2 — Tasks CRUD helpers

**Files:**
- Create: `dashboard/lib/tasks.ts`

- [ ] **Step 1: Write `dashboard/lib/tasks.ts`**

```ts
import { getDb, type TaskRow, type TaskStatus } from "./db";

export type CreateTaskInput = {
  prompt: string;
  assignee: string;
  department?: string | null;
  parentTaskId?: number | null;
};

export function createTask(input: CreateTaskInput): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO tasks (prompt, assignee, department, parent_task_id, status, created_at)
     VALUES (?, ?, ?, ?, 'queued', ?)`
  );
  return Number(
    stmt.run(
      input.prompt,
      input.assignee,
      input.department ?? null,
      input.parentTaskId ?? null,
      Date.now()
    ).lastInsertRowid
  );
}

export function getTask(id: number): TaskRow | null {
  const db = getDb();
  return (db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined) ?? null;
}

export function listTasks(opts: {
  assignee?: string;
  department?: string;
  status?: TaskStatus;
  limit?: number;
} = {}): TaskRow[] {
  const db = getDb();
  const conds: string[] = [];
  const args: unknown[] = [];
  if (opts.assignee) { conds.push("assignee = ?"); args.push(opts.assignee); }
  if (opts.department) { conds.push("department = ?"); args.push(opts.department); }
  if (opts.status) { conds.push("status = ?"); args.push(opts.status); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  args.push(limit);
  return db
    .prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...args) as TaskRow[];
}

export function claimTask(id: number, newAssignee: string): TaskRow | null {
  const db = getDb();
  const tx = db.transaction((id: number, assignee: string) => {
    const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined;
    if (!row) return null;
    if (row.status !== "queued") {
      throw new Error(`task ${id} not in queued state (current: ${row.status})`);
    }
    db.prepare(
      `UPDATE tasks SET assignee = ?, status = 'claimed' WHERE id = ?`
    ).run(assignee, id);
    return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow;
  });
  return tx(id, newAssignee);
}

export function startTask(id: number, runId: number): TaskRow | null {
  const db = getDb();
  const tx = db.transaction((id: number, runId: number) => {
    const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined;
    if (!row) return null;
    if (row.status !== "claimed" && row.status !== "queued") {
      throw new Error(`task ${id} not startable (current: ${row.status})`);
    }
    db.prepare(
      `UPDATE tasks SET status = 'running', started_at = ?, run_id = ? WHERE id = ?`
    ).run(Date.now(), runId, id);
    db.prepare(`UPDATE runs SET task_id = ? WHERE id = ?`).run(id, runId);
    return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow;
  });
  return tx(id, runId);
}

export function finishTask(
  id: number,
  status: "done" | "failed",
  error: string | null = null
): TaskRow | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined;
  if (!row) return null;
  db.prepare(
    `UPDATE tasks SET status = ?, finished_at = ?, error = ? WHERE id = ?`
  ).run(status, Date.now(), error, id);
  return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow;
}

export function childrenOf(id: number): TaskRow[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC`)
    .all(id) as TaskRow[];
}
```

- [ ] **Step 2: Type-check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/tasks.ts
git commit -m "phase6.2: tasks CRUD helpers with transactional state changes"
```

## Task 6.2.3 — Round-trip test script

**Files:**
- Create: `dashboard/scripts/test-tasks.mjs`
- Modify: `dashboard/package.json` — add `test:tasks`

- [ ] **Step 1: Create `dashboard/scripts/test-tasks.mjs`**

```js
#!/usr/bin/env node
// Round-trip lifecycle test for the tasks table.
// Runs against a temp SQLite DB (not the dev DB).
// Exits 0 on pass, 1 on first assertion failure.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-test-"));
const tmpDb = path.join(tmpDir, "state.db");
process.env.AGENTIC_OS_DB = path.relative(repoRoot, tmpDb);

// tsx handles .ts imports natively. Run via: tsx scripts/test-tasks.mjs
const { getDb, insertRun, finishRun } = await import("../lib/db.ts");
const tasks = await import("../lib/tasks.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    process.exit(1);
  }
  console.log(`OK    ${msg}`);
}

try {
  getDb(); // triggers migration
  const id = tasks.createTask({ prompt: "test prompt", assignee: "lead:research", department: "research" });
  assert(id > 0, "createTask returns positive id");

  const initial = tasks.getTask(id);
  assert(initial?.status === "queued", "new task is queued");
  assert(initial?.department === "research", "department persisted");
  assert(initial?.parent_task_id === null, "no parent by default");

  const claimed = tasks.claimTask(id, "arxiv-watcher");
  assert(claimed?.status === "claimed", "claim moves to claimed");
  assert(claimed?.assignee === "arxiv-watcher", "claim updates assignee");

  const runId = insertRun({ skillSlug: "test", prompt: "p", agent: "arxiv-watcher" });
  const started = tasks.startTask(id, runId);
  assert(started?.status === "running", "start moves to running");
  assert(started?.run_id === runId, "run_id linked");

  finishRun(runId, "done", null, null, {});
  const done = tasks.finishTask(id, "done");
  assert(done?.status === "done", "finish moves to done");
  assert(done?.finished_at !== null, "finished_at stamped");

  const child = tasks.createTask({
    prompt: "follow-up",
    assignee: "lead:content",
    department: "content",
    parentTaskId: id,
  });
  const children = tasks.childrenOf(id);
  assert(children.length === 1 && children[0].id === child, "child task links to parent");

  let threw = false;
  try {
    tasks.claimTask(id, "x"); // already done
  } catch {
    threw = true;
  }
  assert(threw, "claim of done task throws");

  const queued = tasks.listTasks({ status: "queued" });
  assert(queued.length === 1 && queued[0].id === child, "listTasks filters by status");

  console.log("\nALL PASS");
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

Note: the import-resolution shim (`.ts` vs `.js`) handles whether the script is run from a TS-aware loader or not. If `node` cannot import `.ts` directly, run the script via `tsx` or compile to JS first. The simplest path: run via `tsx`:

```bash
cd dashboard && npx tsx scripts/test-tasks.mjs
```

If `tsx` is not installed yet, install as a dev dep:

```bash
cd dashboard && npm install -D tsx
```

This is the only new dev dep this plan introduces.

- [ ] **Step 2: Add `test:tasks` script to `dashboard/package.json`**

Replace the `scripts` block to add the line:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "validate:skills": "node scripts/validate-skills.mjs",
    "validate:automations": "node scripts/validate-automations.mjs",
    "validate:agents": "node scripts/validate-agents.mjs",
    "test:tasks": "tsx scripts/test-tasks.mjs"
  }
}
```

And add `"tsx"` to `devDependencies` (npm install handles this when you run the install).

- [ ] **Step 3: Run the test**

Run: `cd dashboard && npm run test:tasks`
Expected: 13 OK lines followed by `ALL PASS`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add dashboard/scripts/test-tasks.mjs dashboard/package.json dashboard/package-lock.json
git commit -m "phase6.2: round-trip test for task lifecycle"
```

## Task 6.2.4 — API: POST/GET `/api/tasks`

**Files:**
- Create: `dashboard/app/api/tasks/route.ts`

- [ ] **Step 1: Write `dashboard/app/api/tasks/route.ts`**

```ts
import { createTask, listTasks } from "@/lib/tasks";
import type { TaskStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS: TaskStatus[] = ["queued", "claimed", "running", "done", "failed"];

export async function POST(req: Request) {
  let body: {
    prompt?: string;
    assignee?: string;
    department?: string;
    parentTaskId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.prompt || typeof body.prompt !== "string") {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  if (!body.assignee || typeof body.assignee !== "string") {
    return Response.json({ error: "assignee required" }, { status: 400 });
  }
  if (body.prompt.length > 32_000) {
    return Response.json({ error: "prompt too large" }, { status: 413 });
  }
  const id = createTask({
    prompt: body.prompt,
    assignee: body.assignee,
    department: body.department ?? null,
    parentTaskId: typeof body.parentTaskId === "number" ? body.parentTaskId : null,
  });
  return Response.json({ id }, { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as TaskStatus | null;
  const department = url.searchParams.get("department");
  const assignee = url.searchParams.get("assignee");
  if (status && !VALID_STATUS.includes(status)) {
    return Response.json({ error: `invalid status (must be one of ${VALID_STATUS.join(", ")})` }, { status: 400 });
  }
  const tasks = listTasks({
    status: status ?? undefined,
    department: department ?? undefined,
    assignee: assignee ?? undefined,
    limit: 50,
  });
  return Response.json({ tasks });
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/api/tasks/route.ts
git commit -m "phase6.2: POST/GET /api/tasks"
```

## Task 6.2.5 — API: GET `/api/tasks/[id]`

**Files:**
- Create: `dashboard/app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { getTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const task = getTask(n);
  if (!task) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ task });
}
```

Note: Next 16 dynamic segment params are async. The `ctx.params` type is `Promise<{ id: string }>`. If your version returns sync params, drop the `await` and adjust the type. Confirm via `node_modules/next/dist/docs/02-app/01-getting-started/12-route-handlers-and-middleware.mdx` or the equivalent file before iterating.

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/api/tasks/[id]/route.ts
git commit -m "phase6.2: GET /api/tasks/[id]"
```

## Task 6.2.6 — API: POST claim / start / finish

**Files:**
- Create: `dashboard/app/api/tasks/[id]/claim/route.ts`
- Create: `dashboard/app/api/tasks/[id]/start/route.ts`
- Create: `dashboard/app/api/tasks/[id]/finish/route.ts`

- [ ] **Step 1: Write `dashboard/app/api/tasks/[id]/claim/route.ts`**

```ts
import { claimTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { assignee?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.assignee || typeof body.assignee !== "string") {
    return Response.json({ error: "assignee required" }, { status: 400 });
  }
  try {
    const task = claimTask(n, body.assignee);
    if (!task) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ task });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
```

- [ ] **Step 2: Write `dashboard/app/api/tasks/[id]/start/route.ts`**

```ts
import { startTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { runId?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.runId !== "number") {
    return Response.json({ error: "runId required" }, { status: 400 });
  }
  try {
    const task = startTask(n, body.runId);
    if (!task) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ task });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
```

- [ ] **Step 3: Write `dashboard/app/api/tasks/[id]/finish/route.ts`**

```ts
import { finishTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { status?: "done" | "failed"; error?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (body.status !== "done" && body.status !== "failed") {
    return Response.json({ error: "status must be done or failed" }, { status: 400 });
  }
  const task = finishTask(n, body.status, body.error ?? null);
  if (!task) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ task });
}
```

- [ ] **Step 4: Smoke-test the API**

Start the dev server and exercise the lifecycle via curl (or any HTTP tool):

```bash
cd dashboard && npm run dev &
DEV_PID=$!
sleep 3
curl -s -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"smoke","assignee":"lead:research","department":"research"}'
# expect: {"id":1} (or next free id)

curl -s "http://localhost:3000/api/tasks?status=queued"
# expect: {"tasks":[{...}]}

curl -s -X POST http://localhost:3000/api/tasks/1/claim \
  -H 'Content-Type: application/json' \
  -d '{"assignee":"arxiv-watcher"}'
# expect: claimed status

kill $DEV_PID
```

Expected: every step returns 200/201 with the expected JSON body.

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/tasks/
git commit -m "phase6.2: claim/start/finish API routes"
```

## 6.2 exit criteria

- [ ] `npm run test:tasks` exits 0 with all assertions passing.
- [ ] Fresh DB (`rm .agentic-os/state.db && npm run dev`) migrates cleanly with the `tasks` table created and the `runs.task_id` column added.
- [ ] All five API endpoints respond correctly on the dev server.
- [ ] `dashboard/lib/tasks.ts` provides typed helpers used by the routes.

---

# Sub-phase 6.3 — Assignee picker in workbench

Roadmap reference: `product/roadmap.md:88-98`.

## Task 6.3.1 — Add assignee state and control to PromptPanel

**Files:**
- Modify: `dashboard/components/prompt-panel.tsx`

Add an "Assign to" select that defaults to `user` and lists `lead:<dept>` per department plus named agents.

- [ ] **Step 1: Identify the current PromptPanel signature**

Read `dashboard/components/prompt-panel.tsx` to confirm its current props shape. The exact prop list from 6.1's modified `app/page.tsx` includes `skill`, `project`, `userInput`, `onUserInput`, `onRun`, `running`. The plan extends this with `assignee`, `onAssigneeChange`, `agents`.

- [ ] **Step 2: Edit `dashboard/components/prompt-panel.tsx`** — add an Assignee control above the textarea

Add to the `Props` type:

```ts
type Props = {
  skill: Skill | null;
  project: Project | null;
  userInput: string;
  onUserInput: (v: string) => void;
  onRun: () => void;
  running: boolean;
  agents: Agent[];
  assignee: string;
  onAssigneeChange: (v: string) => void;
};
```

Import `Agent` from `@/lib/agents-loader`. Then, inside the JSX, above the existing `<label htmlFor="user-input">…` block, insert:

```tsx
<div>
  <label htmlFor="assignee" className="mono-label text-muted-foreground">
    ASSIGN TO
  </label>
  <select
    id="assignee"
    value={assignee}
    onChange={(e) => onAssigneeChange(e.target.value)}
    disabled={running}
    className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
  >
    <option value="user">user (run immediately)</option>
    <optgroup label="Departments">
      <option value="lead:research">@research</option>
      <option value="lead:coding">@coding</option>
      <option value="lead:content">@content</option>
      <option value="lead:business">@business</option>
      <option value="lead:productivity">@productivity</option>
    </optgroup>
    {agents.filter((a) => a.role === "member").length > 0 && (
      <optgroup label="Agents">
        {agents
          .filter((a) => a.role === "member")
          .map((a) => (
            <option key={a.name} value={a.name}>
              @{a.name}
            </option>
          ))}
      </optgroup>
    )}
  </select>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/prompt-panel.tsx
git commit -m "phase6.3: assign-to control in prompt panel"
```

## Task 6.3.2 — Workbench branches on assignee

**Files:**
- Modify: `dashboard/components/workbench.tsx`
- Modify: `dashboard/app/page.tsx` (pass agents through)

When assignee is `user` (default), behavior is unchanged (immediate `POST /api/run`). When assignee is anything else, the workbench POSTs to `/api/tasks` to enqueue and shows a brief toast/confirmation instead of streaming output.

- [ ] **Step 1: Pass `agents` from `page.tsx` to `Workbench`**

In `dashboard/app/page.tsx`, change:

```tsx
<Workbench skills={skills} projects={projects} />
```

to:

```tsx
<Workbench skills={skills} projects={projects} agents={agents} />
```

- [ ] **Step 2: Extend Workbench in `dashboard/components/workbench.tsx`**

Add `agents: Agent[]` to `Props`. Add `const [assignee, setAssignee] = useState<string>("user");` to the state block.

Modify the `onRun` callback so it branches:

```tsx
const onRun = useCallback(async () => {
  const hasInput = userInput.trim().length > 0;
  if (!skill && !hasInput) return;

  // Assignee is not "user" → enqueue as a task, do not stream
  if (assignee !== "user") {
    const dept = assignee.startsWith("lead:") ? assignee.slice(5) : null;
    const promptText = skill ? `Use ${skill.name}.\n${userInput}` : userInput;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          assignee,
          department: dept,
        }),
      });
      const j = await res.json();
      setEvents([
        {
          type: "delta",
          data: res.ok
            ? `Task ${j.id} enqueued for ${assignee}.\n`
            : `Error: ${j.error ?? "enqueue failed"}\n`,
        },
      ]);
    } catch (e) {
      setEvents([
        { type: "error", data: { message: e instanceof Error ? e.message : String(e) } },
      ]);
    }
    return;
  }

  // assignee === "user" → existing immediate-run path
  setRunning(true);
  resetUsage();
  setActiveMcp(null);
  setEvents([]);
  // ...rest of the existing onRun body unchanged...
}, [skill, project, userInput, assignee, setRunning, resetUsage, mergeUsage, setActiveMcp]);
```

(Replace the existing `onRun` definition with the above. The trailing block after `setEvents([]);` remains exactly as it was in the file before this task — copy verbatim.)

Pass `assignee` and `setAssignee` into `<PromptPanel>`:

```tsx
<PromptPanel
  skill={skill}
  project={project}
  userInput={userInput}
  onUserInput={setUserInput}
  onRun={onRun}
  running={running}
  agents={agents}
  assignee={assignee}
  onAssigneeChange={setAssignee}
/>
```

- [ ] **Step 3: Smoke-test in browser**

Run: `cd dashboard && npm run dev`. Select a skill. Pick "@research" in Assign to. Click RUN. Confirm:

1. Output stream shows `Task N enqueued for lead:research.`.
2. `curl http://localhost:3000/api/tasks?status=queued` shows the new task.
3. Pick "user" and click RUN — old behavior returns.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/workbench.tsx dashboard/app/page.tsx
git commit -m "phase6.3: workbench enqueues when assignee != user"
```

## Task 6.3.3 — Queue counters in TeamRail

**Files:**
- Modify: `dashboard/components/team-rail.tsx`

Add pending/claimed counts per department. Polls `/api/tasks?status=queued` and `/api/tasks?status=claimed` every 5 seconds.

- [ ] **Step 1: Convert team-rail.tsx to a client component with polling**

**Defect discovered during execution (2026-05-14):** `agents-loader.ts` imports `node:fs` at module top level, which Turbopack will pull into the client bundle if any runtime export is imported by a `"use client"` component. Importing `DEPARTMENT_ORDER` or `agentsByDepartment` as values breaks the dev server with `the chunking context does not support external modules (request: node:fs)`. Workaround: import `Agent` as a type-only import and inline the helpers in the client component. The longer fix is to split `agents-loader.ts` into a runtime module (`lib/agents-loader.ts`, server-only) and a constants module (`lib/agent-constants.ts`, isomorphic). Defer the split — inlining is cheaper than restructuring.

Replace the file with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import type { Agent } from "@/lib/agents-loader";
import type { TaskRow } from "@/lib/db";

// Inlined to avoid pulling node:fs (from agents-loader value imports) into the
// client bundle. Keep in sync with lib/agents-loader.ts.
const DEPARTMENT_ORDER = ["research", "coding", "content", "business", "productivity"] as const;

function agentsByDepartment(agents: Agent[]): Map<string, Agent[]> {
  const map = new Map<string, Agent[]>();
  for (const dept of DEPARTMENT_ORDER) map.set(dept, []);
  for (const a of agents) {
    if (!map.has(a.department)) map.set(a.department, []);
    map.get(a.department)!.push(a);
  }
  return map;
}

export function TeamRail({ agents }: { agents: Agent[] }) {
  const byDept = agentsByDepartment(agents);
  const [counts, setCounts] = useState<Record<string, { queued: number; claimed: number }>>({});

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [q, c] = await Promise.all([
          fetch("/api/tasks?status=queued", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/tasks?status=claimed", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        const next: Record<string, { queued: number; claimed: number }> = {};
        for (const dept of DEPARTMENT_ORDER) next[dept] = { queued: 0, claimed: 0 };
        for (const t of (q.tasks ?? []) as TaskRow[]) {
          if (t.department && next[t.department]) next[t.department].queued++;
        }
        for (const t of (c.tasks ?? []) as TaskRow[]) {
          if (t.department && next[t.department]) next[t.department].claimed++;
        }
        setCounts(next);
      } catch {
        // silent
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="TEAM" meta={<Pill tone="muted">{agents.length}</Pill>} />
      {agents.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          No agents. Author profiles under <span className="font-mono">agents/</span>.
        </div>
      )}
      <div className="space-y-2 mt-1">
        {DEPARTMENT_ORDER.map((dept) => {
          const list = byDept.get(dept) ?? [];
          if (list.length === 0) return null;
          const c = counts[dept] ?? { queued: 0, claimed: 0 };
          return (
            <div key={dept}>
              <div className="flex items-center justify-between mono-label text-muted-foreground px-1 py-0.5 uppercase">
                <span>{dept}</span>
                <span className="flex items-center gap-1">
                  {c.queued > 0 && <Pill tone="warn">Q · {c.queued}</Pill>}
                  {c.claimed > 0 && <Pill tone="muted">C · {c.claimed}</Pill>}
                </span>
              </div>
              <ul className="space-y-0.5">
                {list.map((a) => (
                  <li key={a.name} className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="truncate" title={a.description}>{a.name}</span>
                    <Pill tone={a.role === "lead" ? "good" : "muted"}>
                      {a.role.toUpperCase()}
                    </Pill>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke-test**

`cd dashboard && npm run dev`. Enqueue a task to `@research` (Task 6.3.2's flow). Within 5 seconds, the RESEARCH header in the TEAM card shows a `[Q · 1]` pill.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/team-rail.tsx
git commit -m "phase6.3: team rail shows queue depth per department"
```

## 6.3 exit criteria

- [ ] Selecting a department in PromptPanel and clicking RUN enqueues a task and does not stream output.
- [ ] The TEAM rail's queue counter increments within 5 seconds without a page reload.
- [ ] Default (`user`) behavior is unchanged — same SSE-streamed output as before.

---

# Sub-phase 6.4 — Lead routing skill

Roadmap reference: `product/roadmap.md:100-112`.

## Task 6.4.1 — Author the five `<dept>-lead` skill bodies

**Files:**
- Create: `skills/research/research-lead/SKILL.md`
- Create: `skills/coding/coding-lead/SKILL.md`
- Create: `skills/content/content-lead/SKILL.md`
- Create: `skills/business/business-lead/SKILL.md`
- Create: `skills/productivity/productivity-lead/SKILL.md`

Each skill is the *behavior* the lead executes when spawned. The matching agent profile (in `agents/<dept>/<dept>-lead.md`) declares *who runs it* (model, allowlist). The agent's `--append-system-prompt` is the seed prompt from `agents/_prompts/<dept>-lead.md`. The skill body is the operational manual.

- [ ] **Step 1: Create `skills/research/research-lead/SKILL.md`**

```markdown
---
name: research-lead
description: Read the research-department queue, pick a teammate per task based on skill overlap, claim and reassign. Use when the dashboard 'Tick' button fires the research lead loop, or the user says "tick research", "route research queue", "claim research tasks".
license: MIT
allowed-tools: "Read Write WebFetch Bash"
metadata:
  status: authored
  domain: research
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: research-lead
  department: research
  role: lead
---

# Research lead — routing instructions

## Inputs

This skill is invoked by `POST /api/lead/tick` with body `{department: "research"}`.
The spawned `claude -p` receives:

- Append-system-prompt: `agents/_prompts/research-lead.md`
- User prompt: a JSON dump of the current queue, formatted as:

  ```
  {
    "tick_at": "2026-05-14T10:00:00Z",
    "pending": [
      { "id": 12, "prompt": "…", "created_at": …, "department": "research" }
    ]
  }
  ```

## Instructions

1. Parse the JSON queue from the user message.
2. For each pending task:
   1. Read the prompt text.
   2. Read `agents/research/*.md` profiles to enumerate teammates and their
      `allowed-skills`. (Use the Read tool with explicit paths; do not glob
      outside `agents/research/`.)
   3. Score each teammate by counting `allowed-skills` whose names appear as
      substrings in the task prompt (case-insensitive). Highest score wins.
      Ties broken by alphabetical agent name.
   4. If best score is 0, leave the task queued and append to its thread:
      `no teammate matched — holding`
   5. Otherwise:
      - POST to `http://localhost:3000/api/tasks/{id}/claim` with body
        `{"assignee": "<teammate-name>"}`. Use the Bash tool with curl.
      - Append a one-line decision to `vault/threads/<task-id>.md` via
        the Write tool. Construct this path yourself from the task's
        `id` field in the queue JSON — your tick run handles many tasks
        and the orchestrator does not set `$AGENTIC_OS_THREAD_PATH` for
        lead runs:

        ```
        [<ISO timestamp>] research-lead: assigned to <teammate> (matched: <skill>)
        ```

3. After all tasks are processed, write a one-line summary to stdout in
   the form `routed: <N> handed-off, <M> held`. Exit normally.

## Outputs

- Updates per task: thread file at `vault/threads/<task-id>.md` (append-only).
- Side effect: tasks transition from `queued` to `claimed` via API.

## Examples

Input queue with one task:

```json
{"pending":[{"id":12,"prompt":"summarize today's arxiv ML papers","department":"research"}]}
```

Expected behavior: arxiv-watcher's `allowed-skills` include `paper-search`
and `arxiv-daily-digest`. The prompt contains "arxiv" so it scores 1.
Claim to arxiv-watcher; append thread note. stdout: `routed: 1 handed-off, 0 held`.

## Troubleshooting

- `claim returned 409`: the task moved out of `queued` between read and write.
  Skip it and continue with the next task. Append a thread note saying
  `tick saw 409 on claim — task moved`.
- `no agents in agents/research/`: the validator should have caught this.
  Exit with stdout `error: no research agents found` and exit code 1.
```

- [ ] **Step 2: Create `skills/coding/coding-lead/SKILL.md`**

```markdown
---
name: coding-lead
description: Read the coding-department queue, pick a teammate per task based on skill overlap, claim and reassign. Triggers from the dashboard 'Tick' button for coding.
license: MIT
allowed-tools: "Read Write Bash"
metadata:
  status: authored
  domain: coding
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: coding-lead
  department: coding
  role: lead
---

# Coding lead — routing instructions

Same algorithm as `research-lead`. See `skills/research/research-lead/SKILL.md`
for the routing protocol. The only differences:

- Read profiles from `agents/coding/*.md` (not `agents/research/`).
- If no member agents exist, append to the thread `no coding teammates authored — holding`
  for every queued task and exit `routed: 0 handed-off, <N> held`.
```

- [ ] **Step 3: Create `skills/content/content-lead/SKILL.md`**

```markdown
---
name: content-lead
description: Read the content-department queue, pick a teammate per task. Triggers from the dashboard 'Tick' button for content.
license: MIT
allowed-tools: "Read Write Bash"
metadata:
  status: authored
  domain: content
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: content-lead
  department: content
  role: lead
---

# Content lead — routing instructions

See `skills/research/research-lead/SKILL.md` for the routing protocol.
Read profiles from `agents/content/*.md`. No content members exist yet;
hold the queue with thread notes.
```

- [ ] **Step 4: Create `skills/business/business-lead/SKILL.md`**

```markdown
---
name: business-lead
description: Read the business-department queue, route venture-side tasks. Triggers from the dashboard 'Tick' button for business.
license: MIT
allowed-tools: "Read Write Bash"
metadata:
  status: authored
  domain: business
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: business-lead
  department: business
  role: lead
---

# Business lead — routing instructions

See `skills/research/research-lead/SKILL.md` for the routing protocol.
Read profiles from `agents/business/*.md`. No business members exist yet;
hold the queue.
```

- [ ] **Step 5: Create `skills/productivity/productivity-lead/SKILL.md`**

```markdown
---
name: productivity-lead
description: Read the productivity-department queue, route daily-ops tasks. Triggers from the dashboard 'Tick' button for productivity.
license: MIT
allowed-tools: "Read Write Bash"
metadata:
  status: authored
  domain: productivity
  mode: local
  mcp-server: none
  external-apis: []
  outputs:
    - vault/threads/<task-id>.md
  cadence: M
  agent: productivity-lead
  department: productivity
  role: lead
---

# Productivity lead — routing instructions

See `skills/research/research-lead/SKILL.md` for the routing protocol.
Read profiles from `agents/productivity/*.md`. The existing inbox-triage,
daily-rollup, vault-cleanup are tool-style skills, not agent-routed.
For each queued task, append thread note `running directly — no agent indirection`
and claim to `assignee: user` so the workbench can pick it up directly.
```

- [ ] **Step 6: Validate**

Run: `cd dashboard && npm run validate:skills`
Expected: all OK, exit 0.

- [ ] **Step 7: Commit**

```bash
git add skills/research/research-lead skills/coding/coding-lead skills/content/content-lead skills/business/business-lead skills/productivity/productivity-lead
git commit -m "phase6.4: five lead skill bodies"
```

## Task 6.4.2 — Extend claude-headless to accept appendSystemPrompt and extraEnv

**Files:**
- Modify: `dashboard/lib/claude-headless.ts`

Add two optional fields to the `runClaude` options. `appendSystemPrompt` is the lead seed; `extraEnv` carries `AGENTIC_OS_THREAD_PATH` for thread writes.

- [ ] **Step 1: Edit `dashboard/lib/claude-headless.ts:30-46`**

Replace the existing `runClaude` signature and arg construction:

```ts
export async function* runClaude(opts: {
  prompt: string;
  cwd?: string;
  mcpConfigPath?: string;
  appendSystemPrompt?: string;
  extraEnv?: Record<string, string>;
}): AsyncGenerator<ClaudeEvent> {
  if (opts.prompt.length > 32_000) {
    yield { type: "error", data: { message: "prompt too large" } };
    return;
  }
  const cwd = opts.cwd ?? repoRoot;
  if (!isCwdAllowed(cwd)) {
    yield { type: "error", data: { message: `cwd not allowed: ${cwd}` } };
    return;
  }

  const args = ["-p", opts.prompt, "--output-format", "stream-json", "--verbose"];
  if (opts.mcpConfigPath) args.push("--mcp-config", opts.mcpConfigPath);
  if (opts.appendSystemPrompt) args.push("--append-system-prompt", opts.appendSystemPrompt);

  const env = { ...process.env, ...(opts.extraEnv ?? {}) };

  const child = spawn(CLAUDE_BIN, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: !CLAUDE_BIN.includes("/") && !CLAUDE_BIN.includes("\\"),
  });
  // ...rest of function unchanged...
```

Keep the body from line 58 (`const queue: ClaudeEvent[] = [];`) onward exactly as it was. Only the signature and the `spawn(...)` invocation change.

- [ ] **Step 2: Type-check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/claude-headless.ts
git commit -m "phase6.4: claude-headless accepts appendSystemPrompt and extraEnv"
```

## Task 6.4.3 — API: POST /api/lead/tick

**Files:**
- Create: `dashboard/app/api/lead/tick/route.ts`

Spawns the appropriate `<dept>-lead` skill with the queue contents as the user prompt, the lead's seed system prompt appended, and the thread path env var unset (lead doesn't write to a single thread — it appends to multiple per-task threads via Bash + Write).

- [ ] **Step 1: Write `dashboard/app/api/lead/tick/route.ts`**

```ts
import { runClaude } from "@/lib/claude-headless";
import { finishRun, insertRun, type RunUsage } from "@/lib/db";
import { listTasks } from "@/lib/tasks";
import { repoRoot } from "@/lib/paths";
import { loadAgents, leadFor, isDepartment } from "@/lib/agents-loader";
import { loadSkills } from "@/lib/skills-loader";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { department?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.department || !isDepartment(body.department)) {
    return Response.json({ error: "department required (research|coding|content|business|productivity)" }, { status: 400 });
  }

  const dept = body.department;
  const agents = loadAgents();
  const lead = leadFor(dept, agents);
  if (!lead) {
    return Response.json({ error: `no lead authored for department ${dept}` }, { status: 404 });
  }

  const skills = loadSkills();
  const leadSkill = skills.find((s) => s.name === lead.name);
  if (!leadSkill) {
    return Response.json({ error: `lead agent ${lead.name} has no matching skill in skills/` }, { status: 404 });
  }

  const queueAssignee = `lead:${dept}`;
  const queued = listTasks({ assignee: queueAssignee, status: "queued", limit: 50 });

  const queueJson = JSON.stringify({
    tick_at: new Date().toISOString(),
    department: dept,
    pending: queued.map((t) => ({
      id: t.id,
      prompt: t.prompt,
      created_at: t.created_at,
      department: t.department,
    })),
  }, null, 2);

  const prompt = `Use the ${lead.name} skill.\n\nQueue:\n${queueJson}`;

  let appendSystemPrompt: string | undefined;
  if (lead.systemPromptPath) {
    const resolved = path.resolve(repoRoot, "agents", lead.folder, lead.systemPromptPath);
    if (fs.existsSync(resolved)) {
      appendSystemPrompt = fs.readFileSync(resolved, "utf8");
    }
  }

  const runId = insertRun({
    skillSlug: lead.name,
    prompt,
    agent: lead.name,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: "started", runId, department: dept, queueDepth: queued.length });
      let error: string | null = null;
      const usage: RunUsage = {};
      try {
        for await (const evt of runClaude({
          prompt,
          cwd: repoRoot,
          appendSystemPrompt,
        })) {
          send(evt);
          if (evt.type === "error") error = evt.data.message;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        send({ type: "error", data: { message: error } });
      } finally {
        finishRun(runId, error ? "error" : "done", null, error, usage);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/api/lead/tick/route.ts
git commit -m "phase6.4: POST /api/lead/tick spawns the dept lead"
```

## Task 6.4.4 — Tick buttons in TeamRail

**Files:**
- Modify: `dashboard/components/team-rail.tsx`

Add a small `TICK` button next to each department header that POSTs to `/api/lead/tick`.

- [ ] **Step 1: Edit `dashboard/components/team-rail.tsx`**

Add inside the component (above the `return` statement) a callback:

```tsx
const onTick = async (dept: string) => {
  try {
    const res = await fetch("/api/lead/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: dept }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "tick failed" }));
      console.error(`tick ${dept}: ${j.error}`);
    }
  } catch (e) {
    console.error("tick failed", e);
  }
};
```

Then in the department header JSX, alongside the Q/C pills, add the button:

```tsx
<span className="flex items-center gap-1">
  {c.queued > 0 && <Pill tone="warn">Q · {c.queued}</Pill>}
  {c.claimed > 0 && <Pill tone="muted">C · {c.claimed}</Pill>}
  <button
    onClick={() => onTick(dept)}
    className="mono-label text-muted-foreground hover:text-foreground border border-border rounded-sm px-1.5"
    title={`Run ${dept}-lead now`}
  >
    TICK
  </button>
</span>
```

- [ ] **Step 2: Smoke-test end-to-end**

Run: `cd dashboard && npm run dev`. Enqueue a task to @research via the PromptPanel. Click the TICK button next to RESEARCH. Within a few seconds:

- The queue counter for RESEARCH drops to 0 or stays based on whether arxiv-watcher matched.
- The task's status changes to `claimed` with `assignee: arxiv-watcher` (or stays queued with a thread note).
- `vault/threads/<task-id>.md` exists with a decision line.

If the thread file isn't created, check that the dev server has write access to `vault/threads/` (Task 6.6 creates the folder; for 6.4 verification, manually `mkdir vault/threads`).

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/team-rail.tsx
git commit -m "phase6.4: TICK button per department in team rail"
```

## 6.4 exit criteria

- [ ] All five `<dept>-lead` skills pass `npm run validate:skills`.
- [ ] Clicking TICK on a department with a queued task results in that task being claimed (or held with a thread note) within ~10 seconds.
- [ ] The lead's run appears in the RECENT RUNS card with `agent: <dept>-lead`.
- [ ] `--append-system-prompt` injects the seed prompt (verify by inspecting the run's prompt in the runs table).

---

# Sub-phase 6.5 — Cross-agent handoff

Roadmap reference: `product/roadmap.md:114-124`.

## Task 6.5.1 — Expose `metadata.handoff` on Skill

**Files:**
- Modify: `dashboard/lib/skills-loader.ts`

- [ ] **Step 1: Add `handoff` to the `Skill` type and `loadSkills` body**

In `dashboard/lib/skills-loader.ts`, extend the `Skill` type:

```ts
export type Skill = {
  name: string;
  description: string;
  folder: string;
  status: "stub" | "authored";
  domain: string;
  branch: BranchMeta;
  cadence?: "M" | "L" | "R" | "A";
  mode?: string;
  mcpServer?: string;
  externalApis?: string[];
  outputs?: string[];
  isMeta: boolean;
  agent?: string;
  handoff: boolean;
};
```

And in `loadSkills` where each skill is pushed, add:

```ts
      handoff: meta.handoff === true,
```

after the `agent` field. The full push block becomes:

```ts
    skills.push({
      name: fm.name,
      description: fm.description,
      folder,
      status: (meta.status as "stub" | "authored") ?? "authored",
      domain,
      branch: branchFor(domain || folder.split(path.sep)[0]),
      cadence: (meta.cadence as Skill["cadence"]) ?? undefined,
      mode: meta.mode as string | undefined,
      mcpServer: meta["mcp-server"] as string | undefined,
      externalApis: meta["external-apis"] as string[] | undefined,
      outputs: meta.outputs as string[] | undefined,
      isMeta,
      agent: meta.agent as string | undefined,
      handoff: meta.handoff === true,
    });
```

- [ ] **Step 2: Type-check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/skills-loader.ts
git commit -m "phase6.5: expose metadata.handoff on Skill"
```

## Task 6.5.2 — Parse `next-task:` lines in claude-headless

**Files:**
- Modify: `dashboard/lib/claude-headless.ts`

The headless wrapper scans each `delta` line for a `next-task: {...}` prefix and emits a `handoff` event. The orchestrator in `app/api/run/route.ts` handles the POST to `/api/tasks` (Task 6.5.3).

- [ ] **Step 1: Add `handoff` to `ClaudeEvent`**

At the top of `dashboard/lib/claude-headless.ts`, extend the union:

```ts
export type ClaudeEvent =
  | { type: "delta"; data: string }
  | { type: "tool"; data: { name: string; input?: unknown } }
  | { type: "usage"; data: UsageSnapshot }
  | { type: "done"; data: { outputPath: string | null } }
  | { type: "error"; data: { message: string } }
  | { type: "handoff"; data: { assignee: string; prompt: string; parentTaskId?: number } };
```

- [ ] **Step 2: Add a parser**

Add this helper near `scanForWrite`:

```ts
function scanForHandoff(text: string): { assignee: string; prompt: string; parentTaskId?: number } | null {
  const lines = text.split("\n");
  for (const line of lines) {
    const m = line.match(/^next-task:\s*(\{.+\})\s*$/);
    if (!m) continue;
    try {
      const obj = JSON.parse(m[1]) as Record<string, unknown>;
      const assignee = typeof obj.assignee === "string" ? obj.assignee : null;
      const promptText = typeof obj.prompt === "string" ? obj.prompt : null;
      const parent = typeof obj.parent_task_id === "number" ? obj.parent_task_id : undefined;
      if (assignee && promptText) {
        return { assignee, prompt: promptText, parentTaskId: parent };
      }
    } catch {
      // ignore
    }
  }
  return null;
}
```

- [ ] **Step 3: Emit `handoff` events from the delta branch**

Inside the `child.stdout.on("data", …)` callback, in the `delta` normalization block (around line 76-81 of the original file), add a handoff check:

```ts
            if (norm.type === "delta") {
              fullText.push(norm.data);
              const path = scanForWrite(norm.data);
              if (path) outputPath = path;
              const handoff = scanForHandoff(norm.data);
              if (handoff) queue.push({ type: "handoff", data: handoff });
            }
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/claude-headless.ts
git commit -m "phase6.5: parse next-task: lines into handoff events"
```

## Task 6.5.3 — Run route POSTs new task on handoff (if parent opted in)

**Files:**
- Modify: `dashboard/app/api/run/route.ts`

When the run is associated with a parent task, and that task's skill has `metadata.handoff: true`, emitting a `handoff` event creates a child task. Otherwise the event is dropped with a console warning.

- [ ] **Step 1: Edit `dashboard/app/api/run/route.ts`** — accept `taskId`, check handoff flag, enqueue children

Replace the `RunBody` type and the relevant parts of `POST`:

```ts
type RunBody = {
  skillSlug?: string;
  userInput?: string;
  projectSlug?: string;
  prompt?: string;
  agent?: string;
  taskId?: number;
};
```

Inside `POST`, after `const { skillSlug, userInput, … } = body;`, also extract `taskId`:

```ts
  const { skillSlug, userInput, projectSlug, prompt: freeformPrompt, agent, taskId } = body;
```

Import the tasks helper at the top of the file:

```ts
import { createTask } from "@/lib/tasks";
```

After the SSE stream is opened and inside the `for await (const evt of runClaude(…))` loop, add this branch (the run route is in-process, so call `createTask` directly — no loopback HTTP):

```ts
          if (evt.type === "handoff") {
            if (skill?.handoff !== true) {
              send({ type: "delta", data: `[handoff dropped — skill ${skill?.name ?? "(adhoc)"} did not opt in via metadata.handoff: true]\n` });
              continue;
            }
            try {
              const childId = createTask({
                prompt: evt.data.prompt,
                assignee: evt.data.assignee,
                department: evt.data.assignee.startsWith("lead:") ? evt.data.assignee.slice(5) : null,
                parentTaskId: taskId ?? evt.data.parentTaskId ?? null,
              });
              send({ type: "delta", data: `[handoff → task ${childId} for ${evt.data.assignee}]\n` });
            } catch (e) {
              send({ type: "delta", data: `[handoff failed: ${e instanceof Error ? e.message : String(e)}]\n` });
            }
          }
```

- [ ] **Step 2: Smoke-test**

To exercise the handoff path you need a skill with `metadata.handoff: true` that actually emits `next-task: {…}`. The example in `agents/_prompts/arxiv-watcher.md` documents the format. Add a `metadata.handoff: true` line to an existing test skill (e.g. temporarily flag `skills/research/research-lead/` with `handoff: true`, or author a tiny test skill `skills/_meta/handoff-test/SKILL.md` whose body emits one `next-task:` line).

Run a task and confirm:
- A child task is created in the `tasks` table with `parent_task_id` set.
- Without the flag, the SSE output shows `[handoff dropped — …]`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/api/run/route.ts
git commit -m "phase6.5: enqueue child task on handoff event when parent opted in"
```

## Task 6.5.4 — Task chain API and component

**Files:**
- Create: `dashboard/app/api/tasks/[id]/chain/route.ts`
- Create: `dashboard/components/task-chain.tsx`

- [ ] **Step 1: Write `dashboard/app/api/tasks/[id]/chain/route.ts`**

```ts
import { childrenOf, getTask } from "@/lib/tasks";
import type { TaskRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const root = getTask(n);
  if (!root) return Response.json({ error: "not found" }, { status: 404 });

  // Walk up to find the topmost ancestor
  let top: TaskRow = root;
  const seen = new Set<number>([top.id]);
  while (top.parent_task_id !== null) {
    const parent = getTask(top.parent_task_id);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    top = parent;
  }

  // BFS down from top
  const tree: { task: TaskRow; children: TaskRow[] }[] = [];
  const stack: TaskRow[] = [top];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const kids = childrenOf(cur.id);
    tree.push({ task: cur, children: kids });
    for (const k of kids) {
      if (!seen.has(k.id)) {
        seen.add(k.id);
        stack.push(k);
      }
    }
  }

  return Response.json({ root: top, tree });
}
```

- [ ] **Step 2: Write `dashboard/components/task-chain.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { TaskRow } from "@/lib/db";

type ChainResponse = {
  root: TaskRow;
  tree: { task: TaskRow; children: TaskRow[] }[];
};

export function TaskChain({ taskId }: { taskId: number }) {
  const [chain, setChain] = useState<ChainResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/tasks/${taskId}/chain`, { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as ChainResponse;
      if (!cancelled) setChain(j);
    };
    load();
    return () => { cancelled = true; };
  }, [taskId]);

  if (!chain) return <div className="text-xs text-muted-foreground">Loading chain…</div>;

  const byParent = new Map<number | null, TaskRow[]>();
  byParent.set(chain.root.id, []);
  for (const { task, children } of chain.tree) {
    byParent.set(task.id, children);
  }

  const render = (task: TaskRow, depth: number): React.ReactNode => {
    const children = byParent.get(task.id) ?? [];
    return (
      <div key={task.id} style={{ marginLeft: depth * 12 }} className="border-l border-border pl-2 my-1">
        <div className="font-mono text-xs">
          <span className="text-muted-foreground">#{task.id}</span>{" "}
          <span className="text-foreground">{task.assignee}</span>{" "}
          <span className="text-muted-foreground">[{task.status}]</span>
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2 pl-2">{task.prompt}</div>
        {children.map((c) => render(c, depth + 1))}
      </div>
    );
  };

  return <div>{render(chain.root, 0)}</div>;
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/api/tasks/[id]/chain/route.ts dashboard/components/task-chain.tsx
git commit -m "phase6.5: task chain API and TaskChain component"
```

## 6.5 exit criteria

- [ ] A skill with `metadata.handoff: true` emitting a `next-task: {…}` line on stdout produces a new task with `parent_task_id` set, visible via `/api/tasks?parent_task_id=…` (or by querying the chain endpoint).
- [ ] A skill *without* the handoff flag emitting the same line is silently dropped, with a `[handoff dropped — …]` message in the SSE output.
- [ ] `GET /api/tasks/<id>/chain` returns the full ancestor → descendants tree.
- [ ] `TaskChain` renders the tree with indented children.

---

# Sub-phase 6.6 — Task thread (comments)

Roadmap reference: `product/roadmap.md:126-137`.

## Task 6.6.1 — Create the threads folder

**Files:**
- Create: `vault/threads/.gitkeep`

- [ ] **Step 1: Add the folder and a placeholder**

```bash
mkdir -p vault/threads
touch vault/threads/.gitkeep
git add vault/threads/.gitkeep
git commit -m "phase6.6: vault/threads folder marker"
```

## Task 6.6.2 — Thread API: GET and POST

**Files:**
- Create: `dashboard/app/api/threads/[id]/route.ts`

GET returns the thread file content (or an empty string if it doesn't exist yet). POST appends a user-authored entry with a server-side timestamp.

- [ ] **Step 1: Write `dashboard/app/api/threads/[id]/route.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { threadsPath } from "@/lib/paths";
import { getTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

function threadFileFor(id: number): string {
  return path.join(threadsPath, `${id}.md`);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!getTask(n)) return Response.json({ error: "task not found" }, { status: 404 });
  const file = threadFileFor(n);
  const content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  return Response.json({ content });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!getTask(n)) return Response.json({ error: "task not found" }, { status: 404 });
  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.body || typeof body.body !== "string") {
    return Response.json({ error: "body required" }, { status: 400 });
  }
  if (body.body.length > 8000) {
    return Response.json({ error: "body too long" }, { status: 413 });
  }
  fs.mkdirSync(threadsPath, { recursive: true });
  const line = `[${new Date().toISOString()}] user: ${body.body.replace(/\n/g, " ")}\n`;
  fs.appendFileSync(threadFileFor(n), line);
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/api/threads/[id]/route.ts
git commit -m "phase6.6: GET/POST /api/threads/[id]"
```

## Task 6.6.3 — Pass thread path env var on every run with a taskId

**Files:**
- Modify: `dashboard/app/api/run/route.ts`

When `taskId` is present in the run body, set `AGENTIC_OS_THREAD_PATH` so the skill can write to it via the Write tool.

- [ ] **Step 1: Edit `dashboard/app/api/run/route.ts`** — pass `extraEnv` and `appendSystemPrompt` (for agents)

Add this import to the top of the file (after the existing `@/lib/...` imports):

```ts
import path from "node:path";
```

Above the `runClaude(...)` invocation inside the `start(controller)` callback, build the env vars:

```ts
      const extraEnv: Record<string, string> = {};
      if (taskId) {
        const threadFile = path.join(repoRoot, "vault", "threads", `${taskId}.md`);
        extraEnv.AGENTIC_OS_THREAD_PATH = threadFile;
      }
```

Pass through to `runClaude`:

```ts
        for await (const evt of runClaude({
          prompt,
          cwd,
          mcpConfigPath:
            mcpResolution?.kind === "ready" ? mcpResolution.tmpConfigPath : undefined,
          extraEnv,
        })) {
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/api/run/route.ts
git commit -m "phase6.6: AGENTIC_OS_THREAD_PATH env var when taskId is set"
```

## Task 6.6.4 — TaskThread component

**Files:**
- Create: `dashboard/components/task-thread.tsx`

- [ ] **Step 1: Write `dashboard/components/task-thread.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

export function TaskThread({ taskId }: { taskId: number }) {
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/threads/${taskId}`, { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as { content: string };
    setContent(j.content);
  }, [taskId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const onSend = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await fetch(`/api/threads/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      setDraft("");
      await load();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <div className="mono-label text-muted-foreground mb-2">THREAD</div>
      <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-y-auto bg-background p-2 rounded-sm border border-border font-mono">
        {content || "(empty)"}
      </pre>
      <div className="flex gap-2 mt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Append note…"
          disabled={posting}
          className="flex-1 rounded-sm border border-border bg-background p-2 text-xs font-mono"
        />
        <button
          onClick={onSend}
          disabled={posting || !draft.trim()}
          className="rounded-sm border border-border px-3 text-xs font-mono hover:bg-accent/20"
        >
          {posting ? "…" : "SEND"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/task-thread.tsx
git commit -m "phase6.6: TaskThread component with append textarea"
```

## Task 6.6.5 — Task detail page

**Files:**
- Create: `dashboard/app/tasks/[id]/page.tsx`

Renders the chain + thread for a given task. Confirm Next 16's dynamic-segment param shape via `node_modules/next/dist/docs/02-app/01-getting-started/01-installation.mdx` (or equivalent file in the installed Next version).

- [ ] **Step 1: Write `dashboard/app/tasks/[id]/page.tsx`**

**Defect discovered during execution (2026-05-14):** `<Header />` internally calls `useRunState()`, which throws "useRunState must be used inside RunStateProvider" if rendered outside one. The detail page must wrap its tree in `<RunStateProvider>` like `app/page.tsx` does. Without the wrapper, `/tasks/<id>` returns HTTP 500 at runtime (tsc still passes because the dependency is via React context, not types).

```tsx
import { Starfield } from "@/components/starfield";
import { Header } from "@/components/header";
import { RunStateProvider } from "@/components/run-state";
import { TaskChain } from "@/components/task-chain";
import { TaskThread } from "@/components/task-thread";
import { getTask } from "@/lib/tasks";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) notFound();
  const task = getTask(n);
  if (!task) notFound();

  return (
    <RunStateProvider>
      <Starfield />
      <Header />
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="border border-border rounded-md bg-card/60 px-3 py-2">
          <div className="mono-label text-muted-foreground">TASK · {task.id}</div>
          <div className="text-sm font-mono mt-1">{task.prompt}</div>
          <div className="text-xs text-muted-foreground mt-2 font-mono">
            assignee: {task.assignee} · status: {task.status} · dept: {task.department ?? "—"}
          </div>
        </div>
        <TaskChain taskId={task.id} />
        <TaskThread taskId={task.id} />
      </main>
    </RunStateProvider>
  );
}
```

- [ ] **Step 2: Smoke-test the page**

`cd dashboard && npm run dev`. Navigate to `http://localhost:3000/tasks/1` (or whichever id exists). Confirm:
- Page renders without 404 for valid ids.
- Returns 404 for nonexistent ids.
- Chain renders parent → children for a task created in 6.5's smoke-test.
- Thread input appends a line; reload preserves it.

- [ ] **Step 3: Commit**

```bash
git add dashboard/app/tasks/[id]/page.tsx
git commit -m "phase6.6: /tasks/[id] detail page"
```

## Task 6.6.6 — Thread append test

**Files:**
- Create: `dashboard/scripts/test-threads.mjs`
- Modify: `dashboard/package.json` — add `test:threads`

- [ ] **Step 1: Write `dashboard/scripts/test-threads.mjs`**

```js
#!/usr/bin/env node
// Round-trip test: thread file appends survive across reads.
// Uses real filesystem under a temp dir.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-thr-"));
const tmpDb = path.join(tmpDir, "state.db");
const tmpVault = path.join(tmpDir, "vault");
fs.mkdirSync(path.join(tmpVault, "threads"), { recursive: true });

process.env.AGENTIC_OS_DB = path.relative(repoRoot, tmpDb);
process.env.VAULT_PATH = path.relative(repoRoot, tmpVault);

// Run via: tsx scripts/test-threads.mjs
const { getDb } = await import("../lib/db.ts");
const tasks = await import("../lib/tasks.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    process.exit(1);
  }
  console.log(`OK    ${msg}`);
}

try {
  getDb();
  const id = tasks.createTask({ prompt: "thread test", assignee: "lead:research" });
  const threadFile = path.join(tmpVault, "threads", `${id}.md`);

  fs.appendFileSync(threadFile, `[2026-05-14T10:00:00Z] research-lead: assigned to arxiv-watcher\n`);
  fs.appendFileSync(threadFile, `[2026-05-14T10:00:01Z] arxiv-watcher: starting\n`);

  const content = fs.readFileSync(threadFile, "utf8");
  assert(content.includes("research-lead"), "thread contains lead note");
  assert(content.includes("arxiv-watcher"), "thread contains member note");
  assert(content.split("\n").filter(Boolean).length === 2, "thread has two non-empty lines");

  console.log("\nALL PASS");
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Add the script**

In `dashboard/package.json` `scripts`:

```json
    "test:threads": "tsx scripts/test-threads.mjs"
```

- [ ] **Step 3: Run**

Run: `cd dashboard && npm run test:threads`
Expected: 3 OK lines, `ALL PASS`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add dashboard/scripts/test-threads.mjs dashboard/package.json
git commit -m "phase6.6: test-threads round-trip"
```

## 6.6 exit criteria

- [ ] `vault/threads/<task-id>.md` exists after a task has been routed by a lead (verify via the smoke-test in 6.4).
- [ ] `GET /api/threads/<task-id>` returns the file content; `POST` appends a user-authored line with server timestamp.
- [ ] `/tasks/<id>` page renders chain + thread for any task with an id.
- [ ] `npm run test:threads` passes.

---

# Phase 6 exit criteria (gate to call it done)

Per `product/roadmap.md:139-144` — paraphrased and made testable:

- [ ] TJ types "research the NIH stance on FHIR-RAG and draft a Substack section" into the prompt panel with assignee `@research`.
- [ ] Selecting that and clicking RUN enqueues task 1 with `assignee: lead:research`, `department: research`.
- [ ] Clicking TICK on RESEARCH in the TEAM rail spawns `research-lead`, which claims task 1 for `arxiv-watcher` and appends a thread note.
- [ ] Spawning `arxiv-watcher` (manual via workbench or by routing) runs the digest, finishes the task, and emits `next-task: {"assignee":"content-lead",…}` (provided arxiv-watcher's skill body has `metadata.handoff: true`).
- [ ] The handoff creates task 2 with `parent_task_id: 1`, assignee `lead:content`.
- [ ] `/tasks/1` shows the chain: task 1 → task 2; thread shows the routing decisions plus any user comments.

If all six bullets pass on a single end-to-end test, Phase 6 is done. File a follow-up plan for member-agent authoring (content/draft-writer, content/edit, etc.) — that's out of scope here.

---

# Out of scope (deliberately deferred)

These came up during planning and were excluded:

1. **More member agents.** Only `arxiv-watcher` ships. Authoring `coding/pr-reviewer`, `content/draft-writer`, `business/proposal-drafter`, etc., is a follow-on per-skill effort.
2. **`_meta-lead`.** `_meta` is a framework branch; routing meta tasks to a lead is overengineering.
3. **Cron-driven leads.** Plan locks "manual TICK button". Adding `automations/remote/<dept>-lead.md` later is a 30-minute add — defer until queue depth warrants.
4. **Allowed-tools enforcement.** Today `claude -p` accepts `--allowed-tools` but the headless wrapper does not pass agent-profile tool grants through. Tracked as follow-on; advisory via system prompt for now.
5. **Multi-user auth.** Mission non-goal per roadmap.
6. **Postgres / pgvector.** Mission non-goal per roadmap.
7. **Thread reactions / mentions.** Plain append-only markdown is enough.
8. **Validator: SKILL.md `metadata.handoff` typecheck.** Skill validator currently accepts arbitrary metadata; no schema enforcement. If false-positive handoffs become a problem, add a typecheck. Defer.

---

# Theme reference (carryover from dashboard-polish)

This plan reuses tokens and primitives introduced in `docs/plans/2026-05-10-dashboard-polish.md`:

- `Pill`, `SectionHeader`, `StatusDot` primitives in `dashboard/components/ui/`
- `--background`, `--primary`, `--star-color` CSS variables in `dashboard/app/globals.css`
- `mono-label` utility class for the bracketed `[ · LABEL ]` aesthetic

If those primitives are missing (i.e., dashboard-polish wasn't merged before this plan executes), the team-rail, prompt-panel, and task-thread components will fail to import. Cross-check with `git log --grep "phase5" --grep "polish"` before starting 6.1.7.
