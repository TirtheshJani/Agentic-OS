// dashboard/lib/worktrees.ts
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export class WorktreeError extends Error {
  constructor(message: string, public readonly stderr?: string) {
    super(message);
    this.name = "WorktreeError";
  }
}

export interface Worktree {
  path: string;
  branch: string | null;
  head: string;
  isPrimary: boolean;
}

export function worktreePathFor(workspaceRoot: string, projectSlug: string, issueId: number): string {
  return path.join(workspaceRoot, projectSlug, ".worktrees", `issue-${issueId}`);
}

function runGit(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status ?? 1 };
}

function isGitRepo(p: string): boolean {
  if (!fs.existsSync(p)) return false;
  const r = runGit(p, ["rev-parse", "--git-dir"]);
  return r.status === 0;
}

interface CreateOpts {
  sourceRepoPath: string;
  worktreePath: string;
  branchName: string;
  fromBranch?: string;
}

export function createWorktree(opts: CreateOpts): { worktreePath: string; alreadyExisted: boolean } {
  if (!isGitRepo(opts.sourceRepoPath)) {
    throw new WorktreeError(`Not a git repo: ${opts.sourceRepoPath}`);
  }

  if (fs.existsSync(opts.worktreePath)) {
    const list = listWorktrees(opts.sourceRepoPath);
    if (list.some(w => path.resolve(w.path) === path.resolve(opts.worktreePath))) {
      return { worktreePath: opts.worktreePath, alreadyExisted: true };
    }
    throw new WorktreeError(`Path exists but is not a registered worktree: ${opts.worktreePath}`);
  }

  fs.mkdirSync(path.dirname(opts.worktreePath), { recursive: true });

  // Check if branch already exists; if so, reuse it; if not, create it.
  const branchCheck = runGit(opts.sourceRepoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${opts.branchName}`]);
  const args = branchCheck.status === 0
    ? ["worktree", "add", opts.worktreePath, opts.branchName]
    : ["worktree", "add", "-b", opts.branchName, opts.worktreePath, opts.fromBranch ?? "HEAD"];

  const r = runGit(opts.sourceRepoPath, args);
  if (r.status !== 0) {
    throw new WorktreeError(`git worktree add failed (exit ${r.status})`, r.stderr);
  }
  return { worktreePath: opts.worktreePath, alreadyExisted: false };
}

interface RemoveOpts {
  sourceRepoPath: string;
  worktreePath: string;
  force?: boolean;
}

export function removeWorktree(opts: RemoveOpts): void {
  const args = ["worktree", "remove"];
  if (opts.force) args.push("--force");
  args.push(opts.worktreePath);
  const r = runGit(opts.sourceRepoPath, args);
  if (r.status !== 0) {
    // If the worktree was already removed by hand, prune to clean up the registry.
    if (r.stderr.includes("is not a working tree")) {
      runGit(opts.sourceRepoPath, ["worktree", "prune"]);
      if (fs.existsSync(opts.worktreePath)) {
        fs.rmSync(opts.worktreePath, { recursive: true, force: true });
      }
      return;
    }
    throw new WorktreeError(`git worktree remove failed (exit ${r.status})`, r.stderr);
  }
}

export function listWorktrees(sourceRepoPath: string): Worktree[] {
  if (!isGitRepo(sourceRepoPath)) return [];
  const r = runGit(sourceRepoPath, ["worktree", "list", "--porcelain"]);
  if (r.status !== 0) return [];

  const out: Worktree[] = [];
  const blocks = r.stdout.split(/\n\n+/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n");
    let p = "";
    let head = "";
    let branch: string | null = null;
    let isPrimary = false;
    for (const line of lines) {
      if (line.startsWith("worktree ")) p = path.normalize(line.slice(9));
      else if (line.startsWith("HEAD ")) head = line.slice(5);
      else if (line.startsWith("branch ")) branch = line.slice(7).replace(/^refs\/heads\//, "");
      else if (line === "bare") isPrimary = true;
    }
    if (p) out.push({ path: p, branch, head, isPrimary: isPrimary || out.length === 0 });
  }
  return out;
}
