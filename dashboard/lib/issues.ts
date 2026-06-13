// dashboard/lib/issues.ts
import { getDb } from "@/lib/db";

export type IssueStatus = "backlog" | "queued" | "running" | "review" | "done" | "failed";
export type IssueMode = "sync" | "async";

export interface Issue {
  id: number;
  projectSlug: string;
  title: string;
  body: string;
  assigneeSlug: string | null;
  status: IssueStatus;
  mode: IssueMode;
  priority: number;
  labels: string[];
  githubUrl: string | null;
  githubNumber: number | null;
  parentIssueId: number | null;
  createdAt: number;
  updatedAt: number;
}

interface CreateOpts {
  projectSlug: string;
  title: string;
  body?: string;
  assigneeSlug?: string | null;
  status?: IssueStatus;
  mode?: IssueMode;
  priority?: number;
  labels?: string[];
  githubUrl?: string | null;
  githubNumber?: number | null;
  parentIssueId?: number | null;
}

function rowToIssue(row: any): Issue {
  return {
    id: row.id,
    projectSlug: row.project_slug,
    title: row.title,
    body: row.body,
    assigneeSlug: row.assignee_slug,
    status: row.status as IssueStatus,
    mode: row.mode as IssueMode,
    priority: row.priority,
    labels: row.labels ? JSON.parse(row.labels) : [],
    githubUrl: row.github_url,
    githubNumber: row.github_number,
    parentIssueId: row.parent_issue_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createIssue(opts: CreateOpts): number {
  const db = getDb();
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO issues
      (project_slug, title, body, assignee_slug, status, mode, priority, labels, github_url, github_number, parent_issue_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.projectSlug,
    opts.title,
    opts.body ?? "",
    opts.assigneeSlug ?? null,
    opts.status ?? "backlog",
    opts.mode ?? "async",
    opts.priority ?? 0,
    opts.labels ? JSON.stringify(opts.labels) : null,
    opts.githubUrl ?? null,
    opts.githubNumber ?? null,
    opts.parentIssueId ?? null,
    now,
    now
  );
  return Number(info.lastInsertRowid);
}

/**
 * Number of ancestors above this issue (0 for a root issue). Used to cap
 * autonomous handoff chains. Cycle-safe via a visited set.
 */
export function chainDepth(issueId: number): number {
  const db = getDb();
  const seen = new Set<number>([issueId]);
  let depth = 0;
  let current = issueId;
  while (depth < 100) {
    const row = db.prepare("SELECT parent_issue_id FROM issues WHERE id = ?").get(current) as
      | { parent_issue_id: number | null }
      | undefined;
    if (!row || row.parent_issue_id == null || seen.has(row.parent_issue_id)) return depth;
    seen.add(row.parent_issue_id);
    current = row.parent_issue_id;
    depth++;
  }
  return depth;
}

export function getIssue(id: number): Issue | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM issues WHERE id = ?").get(id);
  return row ? rowToIssue(row) : null;
}

/** Look up a local issue by its GitHub number within a project. The
 * (project_slug, github_number) pair is the idempotency key for GitHub import. */
export function getIssueByGitHubNumber(projectSlug: string, githubNumber: number): Issue | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM issues WHERE project_slug = ? AND github_number = ?")
    .get(projectSlug, githubNumber);
  return row ? rowToIssue(row) : null;
}

interface ListOpts {
  projectSlug?: string;
  status?: IssueStatus;
}

export function listIssues(opts: ListOpts = {}): Issue[] {
  const db = getDb();
  let sql = "SELECT * FROM issues";
  const where: string[] = [];
  const params: any[] = [];
  if (opts.projectSlug) {
    where.push("project_slug = ?");
    params.push(opts.projectSlug);
  }
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY priority DESC, updated_at DESC";
  return db.prepare(sql).all(...params).map(rowToIssue);
}

interface UpdateOpts {
  title?: string;
  body?: string;
  assigneeSlug?: string | null;
  status?: IssueStatus;
  mode?: IssueMode;
  priority?: number;
  labels?: string[];
  githubUrl?: string | null;
  githubNumber?: number | null;
}

export function updateIssue(id: number, patch: UpdateOpts): Issue | null {
  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const column =
      k === "assigneeSlug" ? "assignee_slug" :
      k === "labels" ? "labels" :
      k === "githubUrl" ? "github_url" :
      k === "githubNumber" ? "github_number" :
      k;
    sets.push(`${column} = ?`);
    params.push(k === "labels" ? JSON.stringify(v) : v);
  }
  if (sets.length === 0) return getIssue(id);
  sets.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  db.prepare(`UPDATE issues SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getIssue(id);
}

export function deleteIssue(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM issues WHERE id = ?").run(id);
}

export const VALID_STATUSES: IssueStatus[] = ["backlog", "queued", "running", "review", "done", "failed"];
export const VALID_MODES: IssueMode[] = ["sync", "async"];
