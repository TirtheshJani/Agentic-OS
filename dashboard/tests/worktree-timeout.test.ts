import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWorktree, WorktreeError } from "@/lib/worktrees";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-wt-timeout-"));
});

afterEach(() => {
  delete process.env.AGENTIC_OS_GIT_BIN;
  delete process.env.AGENTIC_OS_GIT_TIMEOUT_MS;
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("createWorktree never hangs the event loop", () => {
  it("fails fast with WorktreeError when the source is not a repo (real git)", () => {
    const start = Date.now();
    expect(() =>
      createWorktree({
        sourceRepoPath: path.join(WORK, "nope"),
        worktreePath: path.join(WORK, "wt"),
        branchName: "b",
      })
    ).toThrow(WorktreeError);
    expect(Date.now() - start).toBeLessThan(10_000);
  });

  // The bug we fixed: `spawnSync("git", ...)` with no timeout blocks the event
  // loop, so a stalled `git worktree add` freezes the whole server and the run
  // sticks on "Starting...". We reproduce it with a stub `git` that answers the
  // probe calls instantly but sleeps forever on `worktree add`; the timeout must
  // turn that hang into a fast WorktreeError.
  //
  // Skipped on Windows: spawnSync cannot exec a .cmd stub without a shell (the
  // same CreateProcess limitation runGit relies on for the real git.exe), so the
  // stub-script approach is POSIX-only. On Windows the timeout is still active —
  // it is just exercised via the real git path in manual/integration use.
  it.skipIf(process.platform === "win32")(
    "times out instead of hanging when git stalls on `worktree add`",
    () => {
      const stub = path.join(WORK, "git-stub.sh");
      fs.writeFileSync(
        stub,
        [
          "#!/bin/sh",
          'case "$1" in',
          '  rev-parse) echo ".git"; exit 0 ;;',           // isGitRepo -> true
          "  show-ref) exit 1 ;;",                           // branch missing -> create-branch path
          '  worktree) if [ "$2" = "add" ]; then sleep 30; fi; exit 0 ;;', // hang on add
          "  *) exit 0 ;;",
          "esac",
          "",
        ].join("\n")
      );
      fs.chmodSync(stub, 0o755);
      process.env.AGENTIC_OS_GIT_BIN = stub;
      process.env.AGENTIC_OS_GIT_TIMEOUT_MS = "500";

      const start = Date.now();
      let caught: unknown;
      try {
        createWorktree({
          sourceRepoPath: WORK,
          worktreePath: path.join(WORK, "wt", "issue-1"),
          branchName: "agentic-os/issue-1",
        });
      } catch (err) {
        caught = err;
      }
      const elapsed = Date.now() - start;

      expect(caught).toBeInstanceOf(WorktreeError);
      expect((caught as WorktreeError).stderr ?? "").toContain("timed out");
      // Without the timeout this blocks ~30s; with it, comfortably under that.
      expect(elapsed).toBeLessThan(5_000);
    },
    20_000
  );
});
