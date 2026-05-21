// Phase 8.5 — GitHub sync.
//
// Imports issues from a GitHub repo into the `tasks` table, keyed on
// (repo, github_number). Re-imports preserve `agent`, `assignee`,
// `project_slug`, `status`, and `priority` on existing rows so manual
// triage and in-flight runs are never clobbered.
//
// Shells out to the user's local `gh` CLI; no token storage. All shell
// calls use execFile (argv) so issue bodies and comments containing
// newlines, quotes, or backticks pass through without shell parsing.
// Every external call has a 15s timeout and returns a structured
// `{ ok: false, error }` instead of throwing so API routes never crash.
//
// Cap: --limit 200 per import. Pagination beyond 200 is deliberately
// out of scope per roadmap §8.5.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getDb, type TaskStatus } from "./db";

const execFileP = promisify(execFile);

// `gh.exe` on Windows; bare `gh` everywhere else. Honor a CLI override
// if the user has gh somewhere unusual.
const GH_BIN = process.env.GH_BIN ?? "gh";

// Sane timeout: every gh call should be a network round-trip, not a
// long-running operation. If gh hangs (rare) we'd rather return an
// error than block the API route.
const GH_TIMEOUT_MS = 15_000;

// Max issues per import. The GitHub `gh issue list` default is 30; we
// raise to 200 to cover the common project size without pagination.
const ISSUE_LIMIT = 200;

export type GhAvailability = { ok: true } | { ok: false; error: string };

let _cached: { ts: number; result: GhAvailability } | null = null;
const AVAILABILITY_TTL_MS = 60_000;

// Probe whether `gh` is installed AND authenticated. `gh auth status`
// exits non-zero on either (no binary on PATH → spawn error; missing
// auth → exit 1 with a message). Cache for 60s to keep the board page
// snappy when it renders the import button.
export async function checkGhAvailable(): Promise<GhAvailability> {
  const now = Date.now();
  if (_cached && now - _cached.ts < AVAILABILITY_TTL_MS) return _cached.result;
  const result = await runGh(["auth", "status"]);
  const availability: GhAvailability = result.ok
    ? { ok: true }
    : { ok: false, error: result.error };
  _cached = { ts: now, result: availability };
  return availability;
}

// Drop the cached availability result. Useful for tests and for the
// rare case where the user runs `gh auth login` during a session.
export function resetGhAvailabilityCache(): void {
  _cached = null;
}

type GhIssue = {
  number: number;
  title: string;
  body: string | null;
  labels: Array<{ name: string }>;
  state: "OPEN" | "CLOSED" | "open" | "closed";
  url: string;
  assignees?: Array<{ login: string }>;
  createdAt?: string;
};

export type ImportSummary = {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
};

// Pull issues from `gh issue list --json ...` and upsert into `tasks`.
// On any gh failure we return { imported: 0, updated: 0, skipped: 0,
// errors: [...] } rather than throwing — keeps API routes safe.
export async function importIssues(
  repo: string,
  opts: { projectSlug?: string | null } = {}
): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, errors: [] };

  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    summary.errors.push(`invalid repo "${repo}" (expected owner/name)`);
    return summary;
  }

  const result = await runGh([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    String(ISSUE_LIMIT),
    "--json",
    "number,title,body,labels,state,url,assignees,createdAt",
  ]);

  if (!result.ok) {
    summary.errors.push(result.error);
    return summary;
  }

  let issues: GhIssue[];
  try {
    const parsed = JSON.parse(result.stdout);
    if (!Array.isArray(parsed)) {
      summary.errors.push(`gh returned non-array JSON`);
      return summary;
    }
    issues = parsed as GhIssue[];
  } catch (e) {
    summary.errors.push(
      `failed to parse gh JSON: ${e instanceof Error ? e.message : String(e)}`
    );
    return summary;
  }

  const db = getDb();
  const selectStmt = db.prepare(
    `SELECT id, status FROM tasks WHERE repo = ? AND github_number = ?`
  );
  const updateStmt = db.prepare(
    `UPDATE tasks
       SET title = ?, prompt = ?, labels = ?, github_url = ?
     WHERE id = ?`
  );
  // On closed-issue auto-archive, we only flip status if the local row
  // is still in `backlog` or `queued` — never clobber in-flight or
  // already-done state.
  const archiveStmt = db.prepare(
    `UPDATE tasks
       SET title = ?, prompt = ?, labels = ?, github_url = ?,
           status = 'done', finished_at = ?
     WHERE id = ?`
  );
  const insertStmt = db.prepare(
    `INSERT INTO tasks (
       prompt, assignee, status, created_at,
       project_slug, title, repo, priority, labels, github_url, github_number
     ) VALUES (?, 'user', ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
  );

  for (const issue of issues) {
    try {
      const labels = JSON.stringify(
        Array.isArray(issue.labels)
          ? issue.labels.map((l) => l.name).filter((n) => typeof n === "string")
          : []
      );
      const body = typeof issue.body === "string" ? issue.body : "";
      const prompt = body.trim().length > 0 ? body : issue.title;
      const state = String(issue.state).toLowerCase();

      const existing = selectStmt.get(repo, issue.number) as
        | { id: number; status: TaskStatus }
        | undefined;

      if (existing) {
        // Re-import: refresh title/prompt/labels/url only. Never touch
        // agent, assignee, project_slug, status, priority.
        if (state === "closed" && (existing.status === "backlog" || existing.status === "queued")) {
          archiveStmt.run(
            issue.title,
            prompt,
            labels,
            issue.url,
            Date.now(),
            existing.id
          );
        } else {
          updateStmt.run(issue.title, prompt, labels, issue.url, existing.id);
        }
        summary.updated++;
      } else {
        // New row: start in backlog (user must triage / assign). Closed
        // issues import as 'done' so the historical record is preserved
        // without polluting the active board columns.
        const initialStatus: TaskStatus = state === "closed" ? "done" : "backlog";
        insertStmt.run(
          prompt,
          initialStatus,
          Date.now(),
          opts.projectSlug ?? null,
          issue.title,
          repo,
          labels,
          issue.url,
          issue.number
        );
        summary.imported++;
      }
    } catch (e) {
      summary.errors.push(
        `issue #${issue?.number ?? "?"}: ${e instanceof Error ? e.message : String(e)}`
      );
      summary.skipped++;
    }
  }

  return summary;
}

// Close a GitHub issue, optionally with a comment. Used by the
// status-flip write-back hook. Never throws; on gh failure the caller
// logs to the task thread and continues.
export async function closeIssue(
  repo: string,
  num: number,
  comment?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { ok: false, error: `invalid repo "${repo}"` };
  }
  if (!Number.isInteger(num) || num <= 0) {
    return { ok: false, error: `invalid issue number ${num}` };
  }
  const args = ["issue", "close", String(num), "--repo", repo];
  if (typeof comment === "string" && comment.trim().length > 0) {
    args.push("--comment", comment);
  }
  const r = await runGh(args);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// Mirror a thread comment to the underlying GitHub issue. Same
// no-throw contract as closeIssue.
export async function commentOnIssue(
  repo: string,
  num: number,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { ok: false, error: `invalid repo "${repo}"` };
  }
  if (!Number.isInteger(num) || num <= 0) {
    return { ok: false, error: `invalid issue number ${num}` };
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    return { ok: false, error: "comment body required" };
  }
  const r = await runGh(["issue", "comment", String(num), "--repo", repo, "--body", body]);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// Parse a github.com URL into "owner/name". Returns null for anything
// that is not a recognized github.com web URL (we explicitly do NOT
// support enterprise GitHub here; that's out of scope per roadmap).
// Trailing `.git`, `/`, and query strings are stripped.
export function parseGithubRepo(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let trimmed = url.trim();
  if (!trimmed) return null;
  // Normalize scp-style `git@github.com:owner/name.git`.
  const scp = trimmed.match(/^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (scp) return `${scp[1]}/${scp[2]}`;
  try {
    if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
    const u = new URL(trimmed);
    if (u.hostname.toLowerCase() !== "github.com") return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    const owner = parts[0];
    let name = parts[1];
    if (!owner || !name) return null;
    if (name.endsWith(".git")) name = name.slice(0, -4);
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null;
    return `${owner}/${name}`;
  } catch {
    return null;
  }
}

type GhResult = { ok: true; stdout: string } | { ok: false; error: string };

// Wrapper around execFile that:
//  - passes args as an array (no shell parsing)
//  - bounds total runtime by GH_TIMEOUT_MS
//  - normalizes spawn failures and non-zero exits into a single error string
//  - on Windows, runs gh.cmd via the shell when needed (gh is a .cmd shim)
async function runGh(args: string[]): Promise<GhResult> {
  try {
    const { stdout } = await execFileP(GH_BIN, args, {
      timeout: GH_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      // Windows: gh ships as gh.exe (works with execFile directly) for the
      // standard installer; if the user has only a .cmd shim, `shell: true`
      // is required. We default to false because execFile with the shim
      // path will succeed when GH_BIN points at the exe. Users with a
      // bare shim can set GH_BIN=gh.cmd and rerun.
      windowsHide: true,
    });
    return { ok: true, stdout };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & {
      stderr?: string | Buffer;
      stdout?: string | Buffer;
      code?: string | number;
    };
    if (err.code === "ENOENT") {
      return { ok: false, error: `gh CLI not found (set GH_BIN or install gh)` };
    }
    const stderr = err.stderr ? String(err.stderr).trim() : "";
    const msg = stderr || (err instanceof Error ? err.message : String(err));
    return { ok: false, error: msg };
  }
}
