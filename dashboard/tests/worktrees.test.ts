import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  createWorktree,
  removeWorktree,
  listWorktrees,
  worktreePathFor,
  WorktreeError,
} from "@/lib/worktrees";

let WORK: string;
let SOURCE: string;

function runGit(cwd: string, args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout;
}

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-wt-"));
  SOURCE = path.join(WORK, "source");
  fs.mkdirSync(SOURCE);
  runGit(SOURCE, ["init", "-b", "main"]);
  runGit(SOURCE, ["config", "user.email", "test@example.com"]);
  runGit(SOURCE, ["config", "user.name", "Test"]);
  fs.writeFileSync(path.join(SOURCE, "README.md"), "# x");
  runGit(SOURCE, ["add", "."]);
  runGit(SOURCE, ["commit", "-m", "init"]);
});

afterEach(() => {
  // Worktrees can leave .git references; clean aggressively.
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("worktrees", () => {
  it("worktreePathFor builds the canonical path", () => {
    const p = worktreePathFor("/ws", "qml", 42);
    expect(p).toBe(path.join("/ws", "qml", ".worktrees", "issue-42"));
  });

  it("createWorktree creates a worktree on a new branch", () => {
    const result = createWorktree({
      sourceRepoPath: SOURCE,
      worktreePath: path.join(WORK, "wt", "issue-1"),
      branchName: "agentic-os/issue-1",
    });
    expect(fs.existsSync(result.worktreePath)).toBe(true);
    expect(fs.existsSync(path.join(result.worktreePath, "README.md"))).toBe(true);
    const branches = runGit(SOURCE, ["branch", "--list"]);
    expect(branches).toContain("agentic-os/issue-1");
  });

  it("createWorktree is idempotent if the same path already exists", () => {
    const wt = path.join(WORK, "wt", "issue-1");
    createWorktree({ sourceRepoPath: SOURCE, worktreePath: wt, branchName: "agentic-os/issue-1" });
    // Second call should not throw if the worktree is already registered.
    const second = createWorktree({ sourceRepoPath: SOURCE, worktreePath: wt, branchName: "agentic-os/issue-1" });
    expect(second.alreadyExisted).toBe(true);
  });

  it("removeWorktree deletes the worktree directory and the git reference", () => {
    const wt = path.join(WORK, "wt", "issue-1");
    createWorktree({ sourceRepoPath: SOURCE, worktreePath: wt, branchName: "agentic-os/issue-1" });
    removeWorktree({ sourceRepoPath: SOURCE, worktreePath: wt });
    expect(fs.existsSync(wt)).toBe(false);
    const list = listWorktrees(SOURCE);
    expect(list.some(w => w.path === wt)).toBe(false);
  });

  it("listWorktrees returns all worktrees including the primary", () => {
    const wt = path.join(WORK, "wt", "issue-1");
    createWorktree({ sourceRepoPath: SOURCE, worktreePath: wt, branchName: "agentic-os/issue-1" });
    const list = listWorktrees(SOURCE);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some(w => w.path === wt)).toBe(true);
  });

  it("createWorktree throws WorktreeError if the source path is not a repo", () => {
    expect(() =>
      createWorktree({
        sourceRepoPath: path.join(WORK, "not-a-repo"),
        worktreePath: path.join(WORK, "wt"),
        branchName: "test",
      })
    ).toThrow(WorktreeError);
  });
});
