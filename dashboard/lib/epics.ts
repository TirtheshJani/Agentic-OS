// dashboard/lib/epics.ts
import { getDb } from "@/lib/db";
import { parseContract, normalizeAssertionText } from "@/lib/evals/contract";

export type EpicStatus = "open" | "closed";

export interface Epic {
  id: number;
  projectSlug: string;
  title: string;
  why: string;
  sharedContract: string;
  milestone: string | null;
  status: EpicStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * A child issue row as read directly from the issues table. We read epic_id and
 * depends_on off the raw row (not via lib/issues rowToIssue, which does not
 * surface them) so epic rollups stay self-contained.
 */
export interface ChildIssue {
  id: number;
  projectSlug: string;
  title: string;
  body: string;
  status: string;
  epicId: number | null;
  dependsOn: number[];
}

interface CreateOpts {
  projectSlug: string;
  title: string;
  why?: string;
  sharedContract?: string;
  milestone?: string | null;
  status?: EpicStatus;
}

function rowToEpic(row: any): Epic {
  return {
    id: row.id,
    projectSlug: row.project_slug,
    title: row.title,
    why: row.why,
    sharedContract: row.shared_contract,
    milestone: row.milestone ?? null,
    status: row.status as EpicStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToChildIssue(row: any): ChildIssue {
  return {
    id: row.id,
    projectSlug: row.project_slug,
    title: row.title,
    body: row.body,
    status: row.status,
    epicId: row.epic_id ?? null,
    dependsOn: parseDependsOn(row.depends_on),
  };
}

/** Parse the depends_on JSON column, tolerating a hand-corrupted value (-> []). */
function parseDependsOn(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

export function createEpic(opts: CreateOpts): number {
  const db = getDb();
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO epics
      (project_slug, title, why, shared_contract, milestone, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.projectSlug,
    opts.title,
    opts.why ?? "",
    opts.sharedContract ?? "",
    opts.milestone ?? null,
    opts.status ?? "open",
    now,
    now
  );
  return Number(info.lastInsertRowid);
}

export function getEpic(id: number): Epic | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM epics WHERE id = ?").get(id);
  return row ? rowToEpic(row) : null;
}

interface ListOpts {
  projectSlug?: string;
}

export function listEpics(opts: ListOpts = {}): Epic[] {
  const db = getDb();
  let sql = "SELECT * FROM epics";
  const params: any[] = [];
  if (opts.projectSlug) {
    sql += " WHERE project_slug = ?";
    params.push(opts.projectSlug);
  }
  sql += " ORDER BY updated_at DESC";
  return db.prepare(sql).all(...params).map(rowToEpic);
}

interface UpdateOpts {
  title?: string;
  why?: string;
  sharedContract?: string;
  milestone?: string | null;
  status?: EpicStatus;
}

export function updateEpic(id: number, patch: UpdateOpts): Epic | null {
  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const column = k === "sharedContract" ? "shared_contract" : k;
    sets.push(`${column} = ?`);
    params.push(v);
  }
  if (sets.length === 0) return getEpic(id);
  sets.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  db.prepare(`UPDATE epics SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return getEpic(id);
}

export function deleteEpic(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM epics WHERE id = ?").run(id);
}

/** All issues filed under an epic, read straight from the issues table. */
export function childIssues(epicId: number): ChildIssue[] {
  const db = getDb();
  return db.prepare("SELECT * FROM issues WHERE epic_id = ?").all(epicId).map(rowToChildIssue);
}

/**
 * Whether a child issue has satisfied its definition of done.
 *
 * Rule: parse the child's spec-0029 acceptance contract from its body. If a
 * contract exists, the child passes only when its most recent judge eval_result
 * rubric marks EVERY contract assertion pass (matched by assertion text). If
 * there is no contract, fall back to the child's status being "done".
 */
export function childPasses(issue: ChildIssue): boolean {
  const assertions = parseContract(issue.body);
  if (assertions.length === 0) return issue.status === "done";

  const db = getDb();
  const row = db.prepare(`
    SELECT e.rubric AS rubric
    FROM eval_results e
    JOIN runs r ON r.id = e.run_id
    WHERE r.issue_id = ? AND e.kind = 'judge' AND e.rubric IS NOT NULL
    ORDER BY e.graded_at DESC
    LIMIT 1
  `).get(issue.id) as { rubric: string | null } | undefined;
  if (!row?.rubric) return false;

  const rubric = JSON.parse(row.rubric) as { assertions?: Array<{ text: string; pass: boolean }> };
  const graded = rubric.assertions ?? [];
  return assertions.every((a) =>
    graded.some((g) => normalizeAssertionText(g.text) === normalizeAssertionText(a.text) && g.pass)
  );
}

/**
 * Derived epic status (never stored): "empty" with no children, "done" only
 * when every child passes, otherwise "in-progress".
 */
export function rollupStatus(epicId: number): "empty" | "in-progress" | "done" {
  const children = childIssues(epicId);
  if (children.length === 0) return "empty";
  return children.every(childPasses) ? "done" : "in-progress";
}

/**
 * Children of an epic whose dependencies are all met. A child is excluded when
 * any id in its depends_on array names an issue that does not pass. Children
 * with no dependencies are always eligible.
 */
export function eligibleChildren(epicId: number): ChildIssue[] {
  const children = childIssues(epicId);
  const passById = new Map<number, boolean>();
  for (const child of children) passById.set(child.id, childPasses(child));
  return children.filter((child) =>
    child.dependsOn.every((depId) => passById.get(depId) ?? depPasses(depId))
  );
}

/** Pass status for a dependency that may live outside the current epic. */
function depPasses(depId: number): boolean {
  const db = getDb();
  const row = db.prepare("SELECT * FROM issues WHERE id = ?").get(depId);
  return row ? childPasses(rowToChildIssue(row)) : false;
}
