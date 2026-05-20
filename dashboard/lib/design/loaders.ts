import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  getDb,
  recentRuns as dbRecentRuns,
  recentVaultChanges,
  type RunRow,
  type TaskRow,
} from "@/lib/db";
import { loadAgents as loadAgentsRaw, agentByName } from "@/lib/agents-loader";
import { loadSkills as loadSkillsRaw } from "@/lib/skills-loader";
import { loadProjects as loadProjectsRaw } from "@/lib/projects-loader";
import { loadSchedules } from "@/lib/schedules";
import { threadsPath } from "@/lib/paths";
import { parseLabels } from "@/lib/ui-utils";
import {
  DEPARTMENTS,
  type Agent,
  type DashboardData,
  type DeptKey,
  type HeroMetrics,
  type InboxItem,
  type Issue,
  type IssueDetail,
  type IssueStatus,
  type OpenIssueCount,
  type Priority,
  type Project,
  type RecentRun,
  type RunningAgent,
  type Settings,
  type Skill,
  type VaultItem,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function deptKeyOf(raw: string | null | undefined, fallback: DeptKey = "infra"): DeptKey {
  if (raw && raw in DEPARTMENTS) return raw as DeptKey;
  return fallback;
}

function priorityOf(raw: string | null): Priority | null {
  if (raw === "urgent" || raw === "high" || raw === "low") return raw;
  if (raw === "med" || raw === "medium") return "medium";
  return null;
}

function statusOf(raw: string | null): IssueStatus {
  const ok: IssueStatus[] = [
    "backlog",
    "queued",
    "claimed",
    "running",
    "review",
    "done",
    "failed",
  ];
  return (ok as readonly string[]).includes(raw ?? "")
    ? (raw as IssueStatus)
    : "queued";
}

function initialsOf(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorForDept(dept: DeptKey | null): string {
  if (!dept) return "#e8eef9";
  return DEPARTMENTS[dept].color;
}

function vaultKindFromPath(p: string): VaultItem["kind"] {
  const normalized = p.replace(/\\/g, "/");
  if (normalized.startsWith("raw/") || normalized.includes("/raw/")) return "raw";
  if (normalized.startsWith("wiki/") || normalized.includes("/wiki/")) return "wiki";
  if (normalized.startsWith("threads/") || normalized.includes("/threads/")) return "thread";
  if (normalized.startsWith("outputs/") || normalized.includes("/outputs/")) return "output";
  return "raw";
}

function formatDurationMs(ms: number | null): string {
  if (ms === null || ms < 0) return "--";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function toRecentRun(run: RunRow, taskById: Map<number, TaskRow>): RecentRun {
  const task = run.task_id ? taskById.get(run.task_id) ?? null : null;
  const durationMs = run.duration_ms ?? (run.ended_at ? null : Date.now() - run.started_at);
  return {
    id: `r-${run.id}`,
    skill: run.skill_slug,
    agent: run.agent ?? task?.assignee ?? "user",
    status: run.status === "running" ? "running" : "done",
    duration: formatDurationMs(durationMs),
    cost: run.cost_usd ?? 0,
    started: new Date(run.started_at).toISOString(),
    issue: task ? String(task.id) : null,
  };
}

function toIssue(task: TaskRow): Issue {
  const labels = parseLabels(task.labels);
  const dept = deptKeyOf(task.department);
  return {
    id: String(task.id),
    title: task.title ?? task.prompt.slice(0, 80),
    desc: task.prompt,
    status: statusOf(task.status),
    priority: priorityOf(task.priority),
    dept,
    skill: null,
    assignee: task.assignee && task.assignee !== "user" ? task.assignee : null,
    reporter: "tj",
    labels,
    created: new Date(task.created_at).toISOString(),
    updated: new Date(
      task.finished_at ?? task.started_at ?? task.created_at
    ).toISOString(),
    cost: 0,
    tokensIn: 0,
    tokensOut: 0,
  };
}

export async function loadDashboard(): Promise<DashboardData> {
  const db = getDb();
  const now = Date.now();
  const sinceDay = now - DAY_MS;

  const heroRow = db
    .prepare(
      `SELECT
         COUNT(*) AS runsToday,
         COALESCE(SUM(cost_usd), 0) AS burn24h,
         COALESCE(SUM(tokens_in), 0) + COALESCE(SUM(tokens_out), 0) AS tokens24h
       FROM runs
       WHERE started_at >= ?`
    )
    .get(sinceDay) as { runsToday: number; burn24h: number; tokens24h: number };

  const runningCountRow = db
    .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'running'`)
    .get() as { n: number };

  const heroMetrics: HeroMetrics = {
    runningAgents: runningCountRow.n,
    burn24h: heroRow.burn24h,
    tokens24h: heroRow.tokens24h,
    runsToday: heroRow.runsToday,
  };

  const runningAgents = await loadRunningAgents();
  const recentRuns = await loadRecentRuns(8);

  const vaultRecents: VaultItem[] = recentVaultChanges(8).map((v) => ({
    path: v.path,
    kind: vaultKindFromPath(v.path),
    changed: new Date(v.ts).toISOString(),
  }));

  const projects = await loadProjects();

  const openCounts = db
    .prepare(
      `SELECT project_slug AS slug, COUNT(*) AS open
         FROM tasks
        WHERE status IN ('backlog', 'queued', 'claimed', 'running', 'review')
          AND project_slug IS NOT NULL
        GROUP BY project_slug`
    )
    .all() as { slug: string; open: number }[];
  const openBySlug = new Map(openCounts.map((r) => [r.slug, r.open]));
  const openIssueCounts: OpenIssueCount[] = projects
    .filter((p) => p.active)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      open: openBySlug.get(p.slug) ?? 0,
    }));

  const agentCount = loadAgentsRaw().length;
  const skillCount = loadSkillsRaw().length;
  const issueCount = (db
    .prepare(`SELECT COUNT(*) AS n FROM tasks`)
    .get() as { n: number }).n;
  const myIssueCount = (db
    .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE assignee = 'user'`)
    .get() as { n: number }).n;
  const inboxCount = await loadInboxCount();

  return {
    heroMetrics,
    runningAgents,
    recentRuns,
    vaultRecents,
    openIssueCounts,
    projects,
    agentCount,
    skillCount,
    inboxCount,
    myIssueCount,
    issueCount,
  };
}

async function loadInboxCount(): Promise<number> {
  const items = await loadInbox();
  return items.length;
}

export async function loadSettings(): Promise<Settings> {
  const agents = loadAgentsRaw();
  const skills = loadSkillsRaw();
  const projects = loadProjectsRaw();
  const schedules = loadSchedules();

  // Read the dashboard version from package.json at runtime; the file lives
  // beside the running Next process so process.cwd() resolves correctly.
  let dashboardVersion = "0.0.0";
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    if (typeof pkg.version === "string") dashboardVersion = pkg.version;
  } catch {}

  // vault_chunks_meta is created by the vault-recall indexer; treat its
  // absence as "never indexed" rather than as an error.
  let lastVaultIndexAt: string | null = null;
  try {
    const db = getDb();
    const row = db
      .prepare(`SELECT MAX(indexed_at) AS ts FROM vault_chunks_meta`)
      .get() as { ts: number | null } | undefined;
    if (row && typeof row.ts === "number") {
      lastVaultIndexAt = new Date(row.ts).toISOString();
    }
  } catch {}

  return {
    dashboardVersion,
    agentCount: agents.length,
    skillCount: skills.length,
    projectCount: projects.length,
    scheduleCount: schedules.length,
    lastVaultIndexAt,
  };
}

export async function loadIssues(
  opts: { project?: string | null; assignee?: string | null } = {}
): Promise<Issue[]> {
  const db = getDb();
  const conds: string[] = [];
  const args: unknown[] = [];
  if (opts.project) {
    conds.push("project_slug = ?");
    args.push(opts.project);
  }
  if (opts.assignee) {
    conds.push("assignee = ?");
    args.push(opts.assignee);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT 500`
    )
    .all(...args) as TaskRow[];
  return rows.map(toIssue);
}

export async function loadIssue(id: string | number): Promise<IssueDetail | null> {
  const db = getDb();
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  const task = db
    .prepare(`SELECT * FROM tasks WHERE id = ?`)
    .get(n) as TaskRow | undefined;
  if (!task) return null;

  const runs = db
    .prepare(
      `SELECT * FROM runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 25`
    )
    .all(n) as RunRow[];

  const taskById = new Map<number, TaskRow>([[task.id, task]]);
  const recentRuns = runs.map((r) => toRecentRun(r, taskById));

  const threadFile = path.join(threadsPath, `${task.id}.md`);
  const threadBody = fs.existsSync(threadFile)
    ? fs.readFileSync(threadFile, "utf8")
    : "";

  // `defaultRepo` only resolves for named-agent assignees; "user" and unset
  // assignees stay null so the launch-button can disable terminal mode.
  let defaultRepo: string | null = null;
  if (task.assignee && task.assignee !== "user") {
    defaultRepo = agentByName(task.assignee)?.defaultRepo ?? null;
  }

  return {
    issue: toIssue(task),
    labels: parseLabels(task.labels),
    recentRuns,
    threadBody,
    projectSlug: task.project_slug,
    defaultRepo,
  };
}

export async function loadAgents(): Promise<Agent[]> {
  const raw = loadAgentsRaw();
  return raw.map((a) => {
    const folderParts = a.folder.split(/[\\/]/);
    const folderDept = folderParts[0] || a.department;
    const dept: DeptKey | null =
      folderDept && folderDept in DEPARTMENTS ? (folderDept as DeptKey) : null;
    return {
      handle: a.name,
      name: a.name,
      kind: "agent",
      initials: initialsOf(a.name),
      color: colorForDept(dept),
      dept,
      description: a.description,
      skills: a.allowedSkills,
    };
  });
}

export async function loadSkills(): Promise<Skill[]> {
  const raw = loadSkillsRaw();
  const schedules = loadSchedules();
  const cadenceBySkill = new Map(schedules.map((s) => [s.skill, s.cron]));

  const db = getDb();
  const runRows = db
    .prepare(
      `SELECT skill_slug AS skill, COUNT(*) AS runs,
              MAX(started_at) AS lastRunMs
         FROM runs
        GROUP BY skill_slug`
    )
    .all() as { skill: string; runs: number; lastRunMs: number | null }[];
  const statsBySkill = new Map(runRows.map((r) => [r.skill, r]));

  return raw.map((s) => {
    const stats = statsBySkill.get(s.name);
    return {
      name: s.name,
      family: s.domain.split("/")[0] || s.domain,
      status: s.status,
      cadence: cadenceBySkill.get(s.name) ?? null,
      runs: stats?.runs ?? 0,
      lastRun: stats?.lastRunMs ? new Date(stats.lastRunMs).toISOString() : "",
      mode: s.mode ?? null,
      mcpServer: s.mcpServer ?? null,
    };
  });
}

export async function loadProjects(): Promise<Project[]> {
  const raw = loadProjectsRaw();
  const db = getDb();
  const openCounts = db
    .prepare(
      `SELECT project_slug AS slug, COUNT(*) AS open
         FROM tasks
        WHERE status IN ('backlog', 'queued', 'claimed', 'running', 'review')
          AND project_slug IS NOT NULL
        GROUP BY project_slug`
    )
    .all() as { slug: string; open: number }[];
  const openBySlug = new Map(openCounts.map((r) => [r.slug, r.open]));

  return raw.map((p) => {
    const dept: DeptKey =
      p.branch && p.branch in DEPARTMENTS ? (p.branch as DeptKey) : "infra";
    return {
      slug: p.slug,
      name: p.name,
      dept,
      active: p.status === "active",
      open: openBySlug.get(p.slug) ?? 0,
      color: DEPARTMENTS[dept].color,
    };
  });
}

export async function loadInbox(): Promise<InboxItem[]> {
  const db = getDb();
  const sinceWeek = Date.now() - 7 * DAY_MS;

  const vaultItems = (db
    .prepare(
      `SELECT * FROM vault_changes WHERE ts >= ? ORDER BY ts DESC LIMIT 100`
    )
    .all(sinceWeek) as { id: number; path: string; kind: string; ts: number }[]
  ).map<InboxItem>((v) => ({
    kind: "vault",
    id: `vault-${v.id}`,
    title: v.path,
    subtitle: v.kind,
    tsIso: new Date(v.ts).toISOString(),
    href: null,
  }));

  const failedRuns = (db
    .prepare(
      `SELECT * FROM runs
        WHERE status = 'error' AND started_at >= ?
        ORDER BY started_at DESC LIMIT 100`
    )
    .all(sinceWeek) as RunRow[]
  ).map<InboxItem>((r) => ({
    kind: "failed-run",
    id: `run-${r.id}`,
    title: r.error ?? `run ${r.id} failed`,
    subtitle: r.skill_slug,
    tsIso: new Date(r.started_at).toISOString(),
    href: r.task_id ? `/issues/${r.task_id}` : null,
  }));

  const backlog = (db
    .prepare(
      `SELECT * FROM tasks
        WHERE assignee = 'user' AND status = 'backlog'
        ORDER BY created_at DESC LIMIT 100`
    )
    .all() as TaskRow[]
  ).map<InboxItem>((t) => ({
    kind: "backlog-task",
    id: `task-${t.id}`,
    title: t.title ?? t.prompt.slice(0, 80),
    subtitle: t.project_slug,
    tsIso: new Date(t.created_at).toISOString(),
    href: `/issues/${t.id}`,
  }));

  return [...vaultItems, ...failedRuns, ...backlog].sort((a, b) =>
    b.tsIso.localeCompare(a.tsIso)
  );
}

export async function loadRunningAgents(): Promise<RunningAgent[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.id AS taskId,
              t.assignee AS agent,
              t.title AS title,
              t.prompt AS prompt,
              t.started_at AS startedAt,
              r.id AS runId,
              r.cost_usd AS costUsd,
              r.tokens_in AS tokensIn,
              r.tokens_out AS tokensOut
         FROM tasks t
         LEFT JOIN runs r ON r.id = (
           SELECT id FROM runs
            WHERE task_id = t.id
            ORDER BY started_at DESC LIMIT 1
         )
        WHERE t.status = 'running'
        ORDER BY t.started_at DESC NULLS LAST, t.created_at DESC`
    )
    .all() as {
    taskId: number;
    agent: string | null;
    title: string | null;
    prompt: string;
    startedAt: number | null;
    runId: number | null;
    costUsd: number | null;
    tokensIn: number | null;
    tokensOut: number | null;
  }[];

  return rows.map((r) => ({
    taskId: r.taskId,
    runId: r.runId,
    agent: r.agent,
    title: r.title ?? r.prompt.slice(0, 80),
    costSoFar: r.costUsd ?? 0,
    tokensIn: r.tokensIn ?? 0,
    tokensOut: r.tokensOut ?? 0,
    startedAtIso: r.startedAt ? new Date(r.startedAt).toISOString() : null,
  }));
}

async function loadRecentRuns(limit: number): Promise<RecentRun[]> {
  const runs = dbRecentRuns(limit);
  const taskIds = runs
    .map((r) => r.task_id)
    .filter((id): id is number => typeof id === "number");
  const taskById = new Map<number, TaskRow>();
  if (taskIds.length > 0) {
    const db = getDb();
    const placeholders = taskIds.map(() => "?").join(", ");
    const tasks = db
      .prepare(`SELECT * FROM tasks WHERE id IN (${placeholders})`)
      .all(...taskIds) as TaskRow[];
    for (const t of tasks) taskById.set(t.id, t);
  }
  return runs.map((r) => toRecentRun(r, taskById));
}

export type { DashboardData, IssueDetail, InboxItem, RunningAgent, Settings };
