# Path A Reset, Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This phase touches process management, PTYs, and external CLI behavior; verify each step's expected output before moving on.

**Goal:** First phase where an agent actually runs end-to-end. The issue you filed against the QML project in Phase 2 can be Started, watched live in xterm.js inside the issue drawer, Stopped if needed, and the resulting work lives in a git worktree you can inspect. Optionally hand off to an external Windows Terminal or iTerm session via `claude --resume`.

**Architecture:** A runtime registry abstracts over agent CLIs (claude-code first, codex/gemini-cli/antigravity later). Each runtime knows how to spawn its CLI inside a PTY using `node-pty`. The dashboard creates a git worktree at `<workspaceRoot>/<slug>/.worktrees/issue-<id>/` per running issue, spawns claude inside that worktree with the issue body typed into stdin programmatically, and streams PTY output to a browser-side xterm.js terminal over WebSocket. Session IDs are captured via a SessionStart hook installed into the worktree's `.claude/settings.local.json`. Concurrency caps are enforced at spawn-time inside the registry.

**Tech Stack additions:** node-pty 1.0.0, xterm 5.5.0 (browser-side terminal emulator), xterm-addon-fit 0.10.0, ws 8.18.0 (WebSocket server for Next.js custom handler).

**Spec:** `specs/0002-path-a-reset.md`. Prior plans: `docs/plans/2026-05-20-path-a-reset-phase-1.md`, `docs/plans/2026-05-20-path-a-reset-phase-2.md`.

---

## Phase 3 Scope

In scope:

- node-pty installed and verified across the platforms the operator actually uses (WSL2 primary, Windows native fallback if `wt.exe` is the chosen terminal for the escape hatch).
- `lib/worktrees.ts`: create, remove, list git worktrees programmatically. Idempotent. Uses `git worktree add/remove/list`.
- Runtime abstraction: `lib/runtime/types.ts` defines the contract, `lib/runtime/registry.ts` registers concrete runtimes, `lib/runtime/claude-code.ts` is the first one.
- Run data layer (`lib/runs.ts`) with CRUD over the `runs` table created in Phase 1.
- WebSocket endpoint that bridges PTY bytes to the browser. Implemented as a Next.js custom server (since the App Router does not natively support WebSocket upgrade).
- xterm.js wired into the issue drawer's Runs tab. Resizes correctly, scrollback retained on tab switch.
- Start button on the issue drawer: validates assignee, creates run, spawns PTY, transitions status to Running. The body of the issue gets typed into the PTY as the agent's first prompt.
- Stop button on the issue drawer: kills the PTY, marks run as failed with reason "stopped by operator".
- Process exit detection: when the spawned CLI exits cleanly, run is marked done; non-zero exit marks it failed. Issue status transitions to Review (operator-mediated) or Failed.
- SessionStart hook installer: writes a tiny shell hook into the worktree's `.claude/settings.local.json` that calls back to the dashboard with the session_id. Fallback path: watch `~/.claude/projects/<encoded-cwd>/*.jsonl` for new files.
- Concurrency caps: 3 active runs per project, 5 active runs globally. Enforced inside `registry.spawn()`. API returns 429 if at cap; UI disables Start button.
- "Open in terminal" escape hatch: button on the run that, once session_id is captured, opens a platform-appropriate terminal (`wt.exe` on Windows, `open -a Terminal` plus `osascript` on macOS, `$TERMINAL` env var on Linux) running `claude --resume <session_id>` in the worktree.
- Worktree management UI: list of worktrees per project, manual "Remove worktree" button (no auto-cleanup, see decision section).

Out of scope:

- Hook events beyond SessionStart (Phase 5 covers SessionEnd, PreToolUse, etc.).
- Cost or usage attribution (Phase 6).
- Second runtime (Phase 7).
- Settings page UI for editing concurrency caps (Phase 6).
- Multi-host or remote agent execution.
- Authentication on the WebSocket endpoint. The dashboard is local-only; if you ever expose it to a network, add auth before doing so.

## Verification strategy

Each task ends with a runnable command and expected output. Phase-level definition of done:

1. From the QML project page, drag the issue you filed in Phase 2 from Queued to nothing (the Start button is in the issue drawer, not the kanban; drag stays at Queued). Open the issue. Click Start.
2. A worktree appears at `<workspaceRoot>/qml-healthcare-diagnostics/.worktrees/issue-<id>/`. The issue drawer's Runs tab activates and shows live xterm output as `claude` initializes inside the worktree.
3. The issue body ("Draft related-work section for QML diagnostics paper, focused on 2024-2026 papers.") has been typed into the agent's prompt. The agent starts working.
4. Within ~5 seconds, the session_id appears on the run (visible in the run metadata strip above xterm). The "Open in terminal" button becomes enabled.
5. Click "Open in terminal". A Windows Terminal (or iTerm/native terminal on other platforms) window opens with `claude --resume <session_id>` running inside the worktree. Type into it; the dashboard's xterm shows the same output a moment later (both sessions are reading the same persistence file).
6. Switch back to the dashboard's xterm and keep observing. When the agent finishes (or you press Stop), the run is recorded as ended. Issue status moves to Review.
7. Check `git -C <workspaceRoot>/qml-healthcare-diagnostics/.worktrees/issue-<id> diff` to see what the agent changed.
8. Try Start on a fourth issue in the same project. The button is disabled and tooltips show "At project concurrency cap (3)". Same for a sixth issue across all projects.
9. All vitest tests pass.

## Architectural decisions

Phase 3 makes the most consequential decisions in this rebuild. Recording them with reasoning so they are not relitigated mid-execution.

### Why node-pty over `child_process.spawn`

The `claude` CLI is interactive and renders a TUI. Plain stdio pipes break terminal control sequences (cursor positioning, alternate screen buffer, line editing). `node-pty` allocates a real pty pair so the CLI thinks it's connected to a terminal, which means `claude` renders correctly. The browser-side xterm.js replays those control sequences accurately. The cost is a native module that needs platform-specific builds; node-pty publishes prebuilt binaries for major platforms but Windows requires Visual Studio Build Tools if a rebuild is forced.

### Why WebSocket and not SSE for PTY

xterm.js needs to send keystrokes back to the server (the operator types into the dashboard's terminal to interact with the running agent). SSE is server-to-client only. WebSocket is bidirectional, which is what we need. SSE remains for the existing `/api/stream` filesystem event channel.

### Why a custom Next.js server for WebSocket

Next.js App Router does not natively support WebSocket upgrades in route handlers. The standard pattern is a thin custom `server.ts` that delegates to the Next.js handler and intercepts WebSocket upgrade requests on a specific path. The Phase 1 scaffolding uses the default `next dev` server; Phase 3 replaces that with `tsx server.ts`. The dev experience is otherwise identical.

### Session ID capture: hybrid hook + jsonl watch

Per GitHub issue #44607 (April 2026), there is no reliable in-session API for a Claude Code session to know its own ID. The two viable patterns are:

1. SessionStart hook in `.claude/settings.local.json` receives `session_id` in its input JSON. Hook script writes the ID to a known file the dashboard watches.
2. Watch `~/.claude/projects/<url-encoded-cwd>/*.jsonl` for new files. The filename is the session_id.

The SessionStart hook is cleaner but has a known bug (#10373) where it sometimes doesn't fire for brand-new sessions on certain platforms. The plan installs the hook AND starts a jsonl watch on spawn, racing the two with a 10-second timeout. Whichever wins first writes the ID to the run record; the other is canceled.

### Worktree cleanup: manual

Auto-removing worktrees on issue-done is risky. The agent may have created files the operator wants to inspect, branch may not be pushed yet, and "Done" is sometimes prematurely set. Phase 3 ships manual worktree management: a "Remove worktree" button on each run, plus a list of stale worktrees on the project page. The operator decides.

### Initial prompt delivery: type into PTY

The cleanest mental model: spawn `claude` in the worktree (interactive, no args), wait briefly for the prompt to appear, then write the issue body to the PTY's stdin followed by Enter. This is what would happen if the operator typed it themselves. Alternatives (passing a `--prompt` flag, writing to a temp file, MCP injection) either don't exist as documented features or introduce coupling we don't want.

### Concurrency cap location: in the registry

Caps must be checked before the worktree gets created (so a failed spawn doesn't leave orphan worktrees). The natural place is inside `registry.spawn()`, which queries the runs table for active runs (rows where `ended_at IS NULL`), compares against the per-project and global caps from settings, and throws a typed `ConcurrencyCapError` if the cap is reached. The API route catches this and returns 429.

### Failure on PTY exit: status moves to Review, not Failed

The agent finishing without crash is success in the technical sense, but the operator still needs to verify the work before calling it Done. So clean exit goes to Review status. Non-zero exit or signal kill goes to Failed (operator can retry or close). This matches the spec's kanban state model.

## File structure

```
dashboard/
  server.ts                                       # NEW: custom server hosting Next + WebSocket
  package.json                                    # MODIFY: scripts use `tsx server.ts`
  lib/
    worktrees.ts                                  # NEW
    runs.ts                                       # NEW
    runtime/
      types.ts                                    # NEW
      registry.ts                                 # NEW
      claude-code.ts                              # NEW
      hookInstaller.ts                            # NEW
      sessionIdCapture.ts                         # NEW
      concurrencyCap.ts                           # NEW
    terminal/
      openExternal.ts                             # NEW: platform-aware terminal spawn
  hooks/
    useRun.ts                                     # NEW
    useRunStream.ts                               # NEW: WebSocket consumer
  components/
    issue/
      RunsTab.tsx                                 # NEW: replaces RunsTabStub
      RunTerminal.tsx                             # NEW: xterm.js host
      RunHeader.tsx                               # NEW: run metadata + buttons
      StartButton.tsx                             # NEW
      StopButton.tsx                              # NEW
      OpenInTerminalButton.tsx                    # NEW
    project/
      WorktreeList.tsx                            # NEW: stale worktree manager
  app/
    api/
      runs/route.ts                               # NEW: POST create
      runs/[id]/route.ts                          # NEW: GET, DELETE (stop)
      runs/[id]/hook/route.ts                     # NEW: SessionStart callback endpoint
      runs/[id]/open-terminal/route.ts            # NEW: POST triggers external terminal spawn
      projects/[slug]/worktrees/route.ts          # NEW: GET list, DELETE one
  scripts/
    claude-session-hook.js                        # NEW: hook script that calls back to dashboard
  tests/
    worktrees.test.ts
    runs.test.ts
    registry.test.ts
    concurrencyCap.test.ts
    sessionIdCapture.test.ts
    hookInstaller.test.ts
```

New runtime dependencies:

```
node-pty@1.0.0
ws@8.18.0
xterm@5.5.0
xterm-addon-fit@0.10.0
xterm-addon-web-links@0.11.0
```

New dev dependencies:

```
@types/ws@8.5.13
```

---

## Task 0: Pre-execution verification

**Files:** none modified. This task is a checklist; nothing to commit. Skip only at your own risk.

The rest of Phase 3 assumes specific CLI behaviors and a working node-pty install. Confirm them now so failures later are mechanical, not "what does the CLI even do."

- [ ] **Step 0: Pick the OS environment you will run the dashboard from.**

If you're on Windows (which you are): run the dashboard from **WSL2**, not Windows native. Reasons:

1. `node-pty` is a native module. Prebuilt binaries cover Linux and macOS reliably; Windows native often needs Visual Studio Build Tools and a manual rebuild that may still fail.
2. The `claude` CLI behaves more predictably under WSL2 because the file-system watcher logic in `~/.claude/projects/` uses inotify under Linux, vs ReadDirectoryChangesW under Windows (which chokidar handles, but with different latency characteristics).
3. The SessionStart hook command we install runs through `sh -c` under WSL2; under Windows native it runs through `cmd.exe`. The plan's hook command is shell-syntax-agnostic (positional args, quoted paths), so both work, but WSL2 has been the more battle-tested path.

You can still open the "Open in terminal" escape hatch into **Windows Terminal** (`wt.exe`) from WSL2: the implementation in Task 13 detects the platform and uses `wt.exe -d` when available. The dashboard process stays in WSL2; only the spawned terminal window lives in Windows.

If you're on macOS or native Linux: just run from your normal shell. None of the WSL2-specific guidance applies.

From this point on, every command in this plan runs from your chosen environment (WSL2 if Windows, otherwise native).

- [ ] **Step 1: Confirm `claude` CLI is installed and on PATH.**

```bash
claude --version
which claude       # or: where.exe claude (Windows)
```

Expected: a version string. If missing, install per `https://docs.claude.com/en/docs/claude-code/setup` before continuing.

- [ ] **Step 2: Confirm `--resume` flag exists and accepts a session ID.**

```bash
claude --help | grep -i resume
```

Expected: a line documenting `--resume` (or `-r`). If absent, this plan's "Open in terminal" feature will not work; the rest still does.

- [ ] **Step 3: Find a real session ID and confirm resume works.**

Run `claude` interactively, type any short prompt, exit. Then:
```bash
# Discover the session file
ls -t ~/.claude/projects/$(echo "$PWD" | sed 's|/|-|g')*/*.jsonl 2>/dev/null | head -1
# Take the basename without .jsonl, that's a session ID. Try resuming:
claude --resume <that-uuid>
```

Expected: the previous session opens. Exit out. If this fails, the escape hatch needs the alternative path (Task 13 covers both).

- [ ] **Step 4: Confirm SessionStart hooks fire.**

Add to `~/.claude/settings.json` (or create it):
```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "echo \"hook fired with $CLAUDE_SESSION_ID\" >> /tmp/agentic-hook-test.log" } ] }
    ]
  }
}
```

Run `claude`, type anything, exit. Check:
```bash
cat /tmp/agentic-hook-test.log
```

Expected: a line was appended. If empty, you're hitting issue #10373; the plan's jsonl watch fallback will handle this, but you should know up front.

Remove the test hook from `~/.claude/settings.json` before continuing.

- [ ] **Step 5: Confirm git worktrees work on at least one of your repos.**

Pick a real repo. From its directory:
```bash
git worktree add /tmp/test-wt -b agentic-os/test
ls /tmp/test-wt
git worktree list
git worktree remove /tmp/test-wt
git worktree prune
```

Expected: each command runs cleanly, the directory appears and disappears. If `git worktree` is unknown, your git is too old (need 2.5+); upgrade.

- [ ] **Step 6: Pick which terminal you want for "Open in terminal".**

Note the choice now since Task 13 needs it:
- Windows: `wt.exe` (Windows Terminal). Verify with `where.exe wt.exe`.
- macOS: iTerm.app or Terminal.app. Verify with `mdfind -name iTerm.app`.
- Linux/WSL: whatever `$TERMINAL` points to, or `gnome-terminal`/`konsole`/`alacritty`.

Write the choice in a sticky note (or just remember).

Phase 3 execution is unblocked.

---

## Task 1: Install node-pty and verify it works

**Files:**
- Modify: `dashboard/package.json`
- Create: `dashboard/scripts/pty-smoke.ts`

- [ ] **Step 1: Install node-pty.**

```bash
cd dashboard
npm install node-pty@1.0.0
```

Expected: install succeeds. On Windows native this may compile from source. If it fails:
- Linux/WSL: `sudo apt install build-essential python3` then retry.
- Windows: `npm install --global windows-build-tools` then retry, or run from WSL2 instead.
- macOS: `xcode-select --install` then retry.

- [ ] **Step 2: Write a tiny smoke test.**

`dashboard/scripts/pty-smoke.ts`:
```ts
import * as pty from "node-pty";

const shell = process.platform === "win32" ? "powershell.exe" : "bash";
const term = pty.spawn(shell, [], {
  name: "xterm-color",
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env as Record<string, string>,
});

let bytes = 0;
term.onData((data) => {
  process.stdout.write(data);
  bytes += Buffer.byteLength(data);
});

term.onExit(({ exitCode }) => {
  console.error(`\n[pty-smoke] exited with code ${exitCode}, received ${bytes} bytes`);
  process.exit(exitCode);
});

// Send a command then exit the shell.
setTimeout(() => term.write("echo pty-smoke-ok && exit\r"), 200);
```

- [ ] **Step 3: Run it.**

```bash
npx tsx scripts/pty-smoke.ts
```

Expected: you see the shell prompt, then `pty-smoke-ok`, then the shell exits with code 0, and the final log line confirms bytes were received. If the process hangs or prints garbage, node-pty isn't working. Stop here, fix the install, do not continue.

- [ ] **Step 4: Commit.**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/scripts/pty-smoke.ts
git commit -m "feat(dashboard): node-pty installed and smoke-tested"
```

---

## Task 2: Worktree management library

**Files:**
- Create: `dashboard/lib/worktrees.ts`, `dashboard/tests/worktrees.test.ts`

- [ ] **Step 1: Write the failing test.**

`dashboard/tests/worktrees.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails.**

```bash
npm test -- worktrees
```

Expected: import errors.

- [ ] **Step 3: Implement `lib/worktrees.ts`.**

```ts
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
      if (line.startsWith("worktree ")) p = line.slice(9);
      else if (line.startsWith("HEAD ")) head = line.slice(5);
      else if (line.startsWith("branch ")) branch = line.slice(7).replace(/^refs\/heads\//, "");
      else if (line === "bare") isPrimary = true;
    }
    if (p) out.push({ path: p, branch, head, isPrimary: isPrimary || out.length === 0 });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes.**

```bash
npm test -- worktrees
```

Expected: 6 passing. If a test hangs, your `git` is misconfigured (missing user.email/name globally); the test sets them in the temp repo but global git hooks can still trip things up.

- [ ] **Step 5: Commit.**

```bash
git add dashboard/lib/worktrees.ts dashboard/tests/worktrees.test.ts
git commit -m "feat(dashboard): git worktree management library"
```

---

## Task 3: Runtime registry interface

**Files:**
- Create: `dashboard/lib/runtime/types.ts`, `dashboard/lib/runtime/registry.ts`, `dashboard/tests/registry.test.ts`

The registry is the contract every CLI runtime implements. Phase 3 ships only claude-code; the contract is designed so codex, antigravity, gemini-cli can plug in later without changes elsewhere.

- [ ] **Step 1: Write the failing test.**

`dashboard/tests/registry.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { registerRuntime, getRuntime, listRuntimes, resetRegistryForTesting } from "@/lib/runtime/registry";
import type { Runtime } from "@/lib/runtime/types";

const fakeRuntime: Runtime = {
  id: "fake",
  displayName: "Fake CLI",
  detect: async () => ({ available: true, version: "1.0" }),
  spawn: async () => { throw new Error("not used in registry test"); },
  formatResumeCommand: (sid) => `fake --resume ${sid}`,
};

beforeEach(() => resetRegistryForTesting());

describe("runtime registry", () => {
  it("registers and retrieves a runtime by id", () => {
    registerRuntime(fakeRuntime);
    expect(getRuntime("fake")?.displayName).toBe("Fake CLI");
  });

  it("returns null for unknown ids", () => {
    expect(getRuntime("nope")).toBeNull();
  });

  it("lists registered runtimes", () => {
    registerRuntime(fakeRuntime);
    registerRuntime({ ...fakeRuntime, id: "other" });
    expect(listRuntimes().map(r => r.id).sort()).toEqual(["fake", "other"]);
  });

  it("registering same id twice overwrites", () => {
    registerRuntime(fakeRuntime);
    registerRuntime({ ...fakeRuntime, displayName: "Updated" });
    expect(getRuntime("fake")?.displayName).toBe("Updated");
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

```bash
npm test -- registry
```

- [ ] **Step 3: Implement the types.**

`dashboard/lib/runtime/types.ts`:
```ts
import type * as pty from "node-pty";

export interface RuntimeAvailability {
  available: boolean;
  version: string | null;
  error?: string;
}

export interface SpawnOpts {
  worktreePath: string;
  initialPrompt: string;
  runId: number;
  issueId: number;
  projectSlug: string;
  cols?: number;
  rows?: number;
}

export interface SpawnedRun {
  pty: pty.IPty;
  /** Subscribe to session_id resolution. Fires at most once per run. If session_id has already resolved when you subscribe, the callback fires immediately with the cached value. */
  onSessionId: (cb: (sid: string) => void) => void;
  /** Inject a session_id from outside (e.g., the SessionStart hook callback). Idempotent: second and later calls are no-ops. Stops any internal jsonl watch. */
  notifySessionId: (sid: string) => void;
  /** Kill the PTY and release any background watchers. Idempotent. */
  cleanup: () => Promise<void>;
}

export interface Runtime {
  /** Stable identifier, e.g. "claude-code". Matches `runtime-default` and `runtime` frontmatter values. */
  id: string;
  displayName: string;
  /** Returns availability + version. Used by the dashboard to show "claude-code 0.5.3" etc. */
  detect(): Promise<RuntimeAvailability>;
  /** Spawn a session in the given worktree and arrange for the initial prompt to be delivered. */
  spawn(opts: SpawnOpts): Promise<SpawnedRun>;
  /** Build the command an external terminal should run to resume the session. */
  formatResumeCommand(sessionId: string): string;
}

export class ConcurrencyCapError extends Error {
  constructor(public readonly scope: "project" | "global", public readonly cap: number, public readonly active: number) {
    super(`At ${scope} concurrency cap: ${active}/${cap}`);
    this.name = "ConcurrencyCapError";
  }
}
```

- [ ] **Step 4: Implement the registry.**

`dashboard/lib/runtime/registry.ts`:
```ts
import type { Runtime } from "@/lib/runtime/types";

const registry = new Map<string, Runtime>();

export function registerRuntime(runtime: Runtime): void {
  registry.set(runtime.id, runtime);
}

export function getRuntime(id: string): Runtime | null {
  return registry.get(id) ?? null;
}

export function listRuntimes(): Runtime[] {
  return Array.from(registry.values());
}

export function resetRegistryForTesting(): void {
  registry.clear();
}
```

- [ ] **Step 5: Run to verify it passes.**

```bash
npm test -- registry
```

Expected: 4 passing.

- [ ] **Step 6: Commit.**

```bash
git add dashboard/lib/runtime/ dashboard/tests/registry.test.ts
git commit -m "feat(runtime): registry interface and types"
```

---

## Task 4: claude-code runtime

**Files:**
- Create: `dashboard/lib/runtime/claude-code.ts`, `dashboard/lib/runtime/sessionIdCapture.ts`, `dashboard/lib/runtime/hookInstaller.ts`, `dashboard/scripts/claude-session-hook.js`
- Create: `dashboard/tests/sessionIdCapture.test.ts`, `dashboard/tests/hookInstaller.test.ts`

This is the most complex task. It covers the SessionStart hook installer, the jsonl-watch fallback for session_id capture, and the actual PTY spawn logic.

- [ ] **Step 1: Write the hook script.**

`dashboard/scripts/claude-session-hook.js`:
```js
#!/usr/bin/env node
// This script is invoked by Claude Code's SessionStart hook.
// Hook input arrives as JSON on stdin. We forward the session_id to the dashboard
// via a known callback URL set in env at install time.
const http = require("node:http");
const https = require("node:https");

let raw = "";
process.stdin.on("data", chunk => raw += chunk);
process.stdin.on("end", () => {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.exit(0); // Don't break the session for hook parse errors.
  }
  const sessionId = parsed.session_id;
  // Args passed by the installed command line. Using argv (not env vars) keeps
  // the hook command portable across bash and cmd.exe; the bash-style
  // VAR=value prefix does not work on Windows native.
  const callback = process.argv[2];
  const runId = process.argv[3];
  if (!sessionId || !callback || !runId) {
    process.exit(0);
  }
  const url = new URL(callback);
  const body = JSON.stringify({ runId: parseInt(runId, 10), sessionId, transcriptPath: parsed.transcript_path ?? null });
  const lib = url.protocol === "https:" ? https : http;
  const req = lib.request({
    method: "POST",
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: url.pathname + url.search,
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
  }, res => {
    res.resume();
    res.on("end", () => process.exit(0));
  });
  req.on("error", () => process.exit(0)); // Silent failure; fallback path will catch.
  req.write(body);
  req.end();
});

// Don't add anything to stdout; SessionStart stdout is injected as context.
```

- [ ] **Step 2: Write the failing test for the hook installer.**

`dashboard/tests/hookInstaller.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { installSessionStartHook } from "@/lib/runtime/hookInstaller";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-hook-"));
});

afterEach(() => {
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("installSessionStartHook", () => {
  it("creates .claude/settings.local.json with a SessionStart hook", () => {
    installSessionStartHook({
      worktreePath: WORK,
      hookScriptPath: "/abs/path/to/hook.js",
      callbackUrl: "http://localhost:3000/api/runs/42/hook",
      runId: 42,
    });
    const settings = JSON.parse(fs.readFileSync(path.join(WORK, ".claude", "settings.local.json"), "utf8"));
    expect(settings.hooks).toBeTruthy();
    expect(settings.hooks.SessionStart).toBeTruthy();
    const hookEntry = settings.hooks.SessionStart[0].hooks[0];
    expect(hookEntry.type).toBe("command");
    expect(hookEntry.command).toContain("/abs/path/to/hook.js");
    expect(hookEntry.command).toContain("http://localhost:3000/api/runs/42/hook");
    expect(hookEntry.command).toMatch(/\b42\b/);
    // Sanity: no bash-only env-prefix syntax leaked back in.
    expect(hookEntry.command).not.toContain("AGENTIC_OS_HOOK_CALLBACK=");
  });

  it("preserves existing settings.local.json fields", () => {
    fs.mkdirSync(path.join(WORK, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(WORK, ".claude", "settings.local.json"),
      JSON.stringify({ env: { FOO: "bar" } })
    );
    installSessionStartHook({
      worktreePath: WORK,
      hookScriptPath: "/x",
      callbackUrl: "http://x",
      runId: 1,
    });
    const settings = JSON.parse(fs.readFileSync(path.join(WORK, ".claude", "settings.local.json"), "utf8"));
    expect(settings.env.FOO).toBe("bar");
    expect(settings.hooks.SessionStart).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run to verify it fails.**

```bash
npm test -- hookInstaller
```

- [ ] **Step 4: Implement `hookInstaller.ts`.**

`dashboard/lib/runtime/hookInstaller.ts`:
```ts
import fs from "node:fs";
import path from "node:path";

interface InstallOpts {
  worktreePath: string;
  hookScriptPath: string;
  callbackUrl: string;
  runId: number;
}

export function installSessionStartHook(opts: InstallOpts): void {
  const settingsDir = path.join(opts.worktreePath, ".claude");
  const settingsPath = path.join(settingsDir, "settings.local.json");
  fs.mkdirSync(settingsDir, { recursive: true });

  let current: any = {};
  if (fs.existsSync(settingsPath)) {
    try {
      current = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      current = {};
    }
  }

  // The command wraps the node script with the env vars the script reads.
  // The command runs the hook script with callback URL and run ID as positional
  // args. Quoting both the script path and the URL handles spaces in paths. We
  // pass these as args rather than env-var prefix (VAR=value node ...) because
  // env-prefix syntax is bash-only and breaks under cmd.exe on Windows native.
  const command = `node "${opts.hookScriptPath}" "${opts.callbackUrl}" ${opts.runId}`;

  current.hooks = current.hooks ?? {};
  current.hooks.SessionStart = [
    {
      hooks: [{ type: "command", command }],
    },
  ];

  fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2));
}
```

- [ ] **Step 5: Run to verify it passes.**

```bash
npm test -- hookInstaller
```

Expected: 2 passing.

- [ ] **Step 6: Write the failing test for sessionIdCapture (jsonl watch fallback).**

`dashboard/tests/sessionIdCapture.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { watchForJsonlSessionId } from "@/lib/runtime/sessionIdCapture";

let TMP: string;

beforeEach(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-sid-"));
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("watchForJsonlSessionId", () => {
  it("resolves with the session_id when a new jsonl file appears", async () => {
    const projectDir = path.join(TMP, "encoded-cwd");
    fs.mkdirSync(projectDir, { recursive: true });

    const handle = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 5000 });

    setTimeout(() => {
      fs.writeFileSync(path.join(projectDir, "abc-123-uuid.jsonl"), "");
    }, 100);

    const sid = await handle.promise;
    expect(sid).toBe("abc-123-uuid");
  });

  it("rejects after timeout if nothing appears", async () => {
    const handle = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 200 });
    await expect(handle.promise).rejects.toThrow(/timeout/i);
  });

  it("cancel() prevents resolution even when a file appears later", async () => {
    const projectDir = path.join(TMP, "encoded-cwd");
    fs.mkdirSync(projectDir, { recursive: true });

    const handle = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 5000 });
    handle.cancel();

    // Wrap promise so we can race with a timeout to confirm it never resolves.
    const settled = await Promise.race([
      handle.promise.then(() => "resolved").catch(() => "rejected"),
      new Promise<string>(resolve => setTimeout(() => resolve("never"), 300)),
    ]);

    // Note: cancel does not reject the promise; it just prevents settlement.
    // The promise stays pending. So "never" is the expected race winner.
    expect(settled).toBe("never");

    // Sanity: writing a file after cancel does nothing.
    fs.writeFileSync(path.join(projectDir, "x.jsonl"), "");
  });

  it("runs two watchers in parallel without interference", async () => {
    const dirA = path.join(TMP, "encoded-cwd-a");
    fs.mkdirSync(dirA, { recursive: true });

    const handleA = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 5000 });
    const handleB = watchForJsonlSessionId({ projectsRoot: TMP, timeoutMs: 5000 });

    setTimeout(() => fs.writeFileSync(path.join(dirA, "sid-A.jsonl"), ""), 50);

    const sidA = await handleA.promise;
    const sidB = await handleB.promise;
    expect(sidA).toBe("sid-A");
    expect(sidB).toBe("sid-A"); // Both watchers see the same new file
  });
});
```

- [ ] **Step 7: Implement `sessionIdCapture.ts`.**

`dashboard/lib/runtime/sessionIdCapture.ts`:
```ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import chokidar, { type FSWatcher } from "chokidar";

interface WatchOpts {
  projectsRoot?: string; // for testing
  timeoutMs?: number;
}

export interface JsonlWatchHandle {
  promise: Promise<string>;
  cancel: () => void;
}

function defaultProjectsRoot(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

/**
 * Per-call watch. Each invocation gets its own chokidar watcher and timeout.
 * Safe to run multiple in parallel (one per concurrent run).
 */
export function watchForJsonlSessionId(opts: WatchOpts = {}): JsonlWatchHandle {
  const root = opts.projectsRoot ?? defaultProjectsRoot();
  const timeoutMs = opts.timeoutMs ?? 15000;

  let watcher: FSWatcher | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  function cleanup() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (watcher) { watcher.close().catch(() => undefined); watcher = null; }
  }

  const promise = new Promise<string>((resolve, reject) => {
    const knownAtStart = new Set<string>();
    function scan(): string[] {
      if (!fs.existsSync(root)) return [];
      const out: string[] = [];
      for (const subdir of fs.readdirSync(root)) {
        const sub = path.join(root, subdir);
        if (!fs.statSync(sub).isDirectory()) continue;
        for (const f of fs.readdirSync(sub)) {
          if (f.endsWith(".jsonl")) out.push(path.join(sub, f));
        }
      }
      return out;
    }
    for (const f of scan()) knownAtStart.add(f);

    watcher = chokidar.watch(root, {
      ignored: /(^|[/\\])\../,
      depth: 2,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    watcher.on("add", (filePath: string) => {
      if (settled) return;
      if (!filePath.endsWith(".jsonl")) return;
      if (knownAtStart.has(filePath)) return;
      const sid = path.basename(filePath, ".jsonl");
      settled = true;
      cleanup();
      resolve(sid);
    });

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Timeout waiting for session jsonl (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      cleanup();
    },
  };
}
```

- [ ] **Step 8: Run to verify it passes.**

```bash
npm test -- sessionIdCapture
```

Expected: 4 passing. The first test resolves in around 100ms, the second after 200ms, the third confirms cancel works, the fourth confirms two parallel watchers don't interfere.

- [ ] **Step 9: Implement the claude-code runtime itself.**

`dashboard/lib/runtime/claude-code.ts`:
```ts
import * as pty from "node-pty";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Runtime, SpawnOpts, SpawnedRun, RuntimeAvailability } from "@/lib/runtime/types";
import { installSessionStartHook } from "@/lib/runtime/hookInstaller";
import { watchForJsonlSessionId } from "@/lib/runtime/sessionIdCapture";
import { REPO_ROOT } from "@/lib/paths";

const HOOK_SCRIPT_PATH = path.join(REPO_ROOT, "dashboard", "scripts", "claude-session-hook.js");

function detectClaude(): RuntimeAvailability {
  const r = spawnSync("claude", ["--version"], { encoding: "utf8" });
  if (r.status !== 0) {
    return { available: false, version: null, error: r.stderr || "claude not on PATH" };
  }
  const m = r.stdout.match(/(\d+\.\d+\.\d+)/);
  return { available: true, version: m ? m[1] : r.stdout.trim() };
}

function getCallbackBaseUrl(): string {
  // The hook script spawned inside `claude` posts back to this URL with the
  // captured session_id. Defaults to the dev port; override with the env var
  // if you change PORT or expose the dashboard at a different host (e.g.,
  // when running behind a proxy or on a non-default port).
  return process.env.AGENTIC_OS_PUBLIC_URL ?? "http://localhost:3000";
}

async function spawnClaude(opts: SpawnOpts): Promise<SpawnedRun> {
  // 1. Install SessionStart hook in worktree so claude calls back with session_id.
  installSessionStartHook({
    worktreePath: opts.worktreePath,
    hookScriptPath: HOOK_SCRIPT_PATH,
    callbackUrl: `${getCallbackBaseUrl()}/api/runs/${opts.runId}/hook`,
    runId: opts.runId,
  });

  // 2. Spawn claude in the worktree.
  const term = pty.spawn("claude", [], {
    name: "xterm-color",
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
    cwd: opts.worktreePath,
    env: { ...process.env } as Record<string, string>,
  });

  // 3. Set up session_id capture. Two paths converge on fireSessionId():
  //    (a) the SessionStart hook → POST /api/runs/[id]/hook → notifyExternalSessionId
  //        → spawned.notifySessionId(sid) → fireSessionId(sid).
  //    (b) the jsonl watcher → resolves with the file's basename as sid → fireSessionId(sid).
  //    Whichever wins, fireSessionId cancels the watcher and fans out to listeners.
  let resolvedSid: string | null = null;
  const sidListeners: Array<(sid: string) => void> = [];

  const jsonlWatch = watchForJsonlSessionId({ timeoutMs: 30000 });

  function fireSessionId(sid: string) {
    if (resolvedSid !== null) return;
    resolvedSid = sid;
    jsonlWatch.cancel();
    const copy = sidListeners.slice();
    sidListeners.length = 0;
    for (const l of copy) {
      try { l(sid); } catch (err) { console.error("[claude-code] sid listener threw:", err); }
    }
  }

  // Start the jsonl fallback. It races the hook with a 30s timeout.
  jsonlWatch.promise
    .then(fireSessionId)
    .catch(() => undefined); // hook may have already won; that's fine

  // 4. Wait for the agent's prompt to be ready, then send the issue body.
  // The 1200ms delay is empirical and may need tuning per machine. The fix-it
  // path is to bump PROMPT_READY_DELAY_MS, not to add prompt-marker detection
  // (which would be runtime-specific and brittle).
  const PROMPT_READY_DELAY_MS = 1200;
  setTimeout(() => {
    try {
      const body = opts.initialPrompt.trim();
      if (body.length > 0) {
        // Carriage return is what cooked-mode terminal driver maps to newline.
        term.write(body + "\r");
      }
    } catch {
      // PTY may have already died; nothing to do.
    }
  }, PROMPT_READY_DELAY_MS);

  return {
    pty: term,
    onSessionId(cb) {
      if (resolvedSid !== null) {
        // Already resolved; fire immediately with cached value.
        try { cb(resolvedSid); } catch (err) { console.error("[claude-code] late sid listener threw:", err); }
        return;
      }
      sidListeners.push(cb);
    },
    notifySessionId(sid) {
      fireSessionId(sid);
    },
    async cleanup() {
      try { term.kill(); } catch { /* already dead */ }
      jsonlWatch.cancel();
    },
  };
}

export const claudeCodeRuntime: Runtime = {
  id: "claude-code",
  displayName: "Claude Code",
  detect: async () => detectClaude(),
  spawn: spawnClaude,
  formatResumeCommand: (sid) => `claude --resume ${sid}`,
};
```

- [ ] **Step 10: Wire the runtime registration at server boot.**

Modify `dashboard/lib/server-init.ts` to register the runtime:
```ts
import { startWatcher } from "@/lib/watcher";
import { registerRuntime } from "@/lib/runtime/registry";
import { claudeCodeRuntime } from "@/lib/runtime/claude-code";

let booted = false;
let bootPromise: Promise<void> | null = null;

export async function ensureServerBooted(): Promise<void> {
  if (booted) return;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    await startWatcher();
    registerRuntime(claudeCodeRuntime);
    booted = true;
  })();
  return bootPromise;
}
```

- [ ] **Step 11: Commit.**

```bash
git add dashboard/lib/runtime/ dashboard/scripts/claude-session-hook.js dashboard/lib/server-init.ts dashboard/tests/hookInstaller.test.ts dashboard/tests/sessionIdCapture.test.ts
git commit -m "feat(runtime): claude-code runtime with hook + jsonl session_id capture"
```

---

## Task 5: Runs data layer and concurrency cap

**Files:**
- Create: `dashboard/lib/runs.ts`, `dashboard/tests/runs.test.ts`
- Create: `dashboard/lib/runtime/concurrencyCap.ts`, `dashboard/tests/concurrencyCap.test.ts`

- [ ] **Step 1: Write the failing test for runs.**

`dashboard/tests/runs.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb } from "@/lib/db";
import { createRun, getRun, listRuns, listActiveRuns, updateRun, attachSessionId } from "@/lib/runs";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-runs-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("runs", () => {
  it("creates and retrieves a run", () => {
    const id = createRun({
      issueId: 7,
      agentSlug: "lit-reviewer",
      runtimeId: "claude-code",
      worktreePath: "/ws/qml/.worktrees/issue-7",
    });
    expect(id).toBeGreaterThan(0);
    const r = getRun(id);
    expect(r).toBeTruthy();
    expect(r!.issueId).toBe(7);
    expect(r!.endedAt).toBeNull();
    expect(r!.ptySessionId).toBeNull();
  });

  it("listActiveRuns returns only runs without an ended_at", () => {
    const a = createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/p1" });
    const b = createRun({ issueId: 2, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/p2" });
    updateRun(b, { endedAt: Date.now(), exitStatus: "done" });
    const active = listActiveRuns();
    expect(active.map(r => r.id)).toEqual([a]);
  });

  it("attachSessionId sets pty_session_id", () => {
    const id = createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/p" });
    attachSessionId(id, "deadbeef-uuid");
    expect(getRun(id)!.ptySessionId).toBe("deadbeef-uuid");
  });

  it("listRuns filters by issue", () => {
    createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/a" });
    createRun({ issueId: 1, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/b" });
    createRun({ issueId: 2, agentSlug: "x", runtimeId: "claude-code", worktreePath: "/c" });
    expect(listRuns({ issueId: 1 })).toHaveLength(2);
    expect(listRuns({ issueId: 2 })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

```bash
npm test -- "tests/runs"
```

- [ ] **Step 3: Implement `lib/runs.ts`.**

```ts
// dashboard/lib/runs.ts
import { getDb } from "@/lib/db";

export interface Run {
  id: number;
  issueId: number;
  agentSlug: string;
  runtimeId: string;
  worktreePath: string;
  ptySessionId: string | null;
  startedAt: number;
  endedAt: number | null;
  exitStatus: string | null;
  transcriptPath: string | null;
}

function rowToRun(row: any): Run {
  return {
    id: row.id,
    issueId: row.issue_id,
    agentSlug: row.agent_slug,
    runtimeId: row.runtime_id,
    worktreePath: row.worktree_path,
    ptySessionId: row.pty_session_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    exitStatus: row.exit_status,
    transcriptPath: row.transcript_path,
  };
}

interface CreateOpts {
  issueId: number;
  agentSlug: string;
  runtimeId: string;
  worktreePath: string;
}

export function createRun(opts: CreateOpts): number {
  const db = getDb();
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO runs (issue_id, agent_slug, runtime_id, worktree_path, started_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(opts.issueId, opts.agentSlug, opts.runtimeId, opts.worktreePath, now);
  return Number(info.lastInsertRowid);
}

export function getRun(id: number): Run | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
  return row ? rowToRun(row) : null;
}

export function listRuns(opts: { issueId?: number } = {}): Run[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];
  if (opts.issueId !== undefined) {
    where.push("issue_id = ?");
    params.push(opts.issueId);
  }
  const sql = `SELECT * FROM runs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY started_at DESC`;
  return db.prepare(sql).all(...params).map(rowToRun);
}

export function listActiveRuns(): Run[] {
  const db = getDb();
  return db.prepare("SELECT * FROM runs WHERE ended_at IS NULL ORDER BY started_at DESC").all().map(rowToRun);
}

export function listActiveRunsForProject(projectSlug: string): Run[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.* FROM runs r
    INNER JOIN issues i ON i.id = r.issue_id
    WHERE r.ended_at IS NULL AND i.project_slug = ?
    ORDER BY r.started_at DESC
  `).all(projectSlug).map(rowToRun);
}

interface UpdateOpts {
  endedAt?: number;
  exitStatus?: string;
  transcriptPath?: string;
  ptySessionId?: string;
}

export function updateRun(id: number, patch: UpdateOpts): void {
  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const column =
      k === "endedAt" ? "ended_at" :
      k === "exitStatus" ? "exit_status" :
      k === "transcriptPath" ? "transcript_path" :
      k === "ptySessionId" ? "pty_session_id" :
      k;
    sets.push(`${column} = ?`);
    params.push(v);
  }
  if (sets.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}

export function attachSessionId(id: number, sessionId: string): void {
  updateRun(id, { ptySessionId: sessionId });
}
```

- [ ] **Step 4: Run to verify it passes.**

```bash
npm test -- "tests/runs"
```

Expected: 4 passing.

- [ ] **Step 5: Write the failing test for concurrency caps.**

`dashboard/tests/concurrencyCap.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb } from "@/lib/db";
import { assertCapacity } from "@/lib/runtime/concurrencyCap";
import { createRun } from "@/lib/runs";
import { ConcurrencyCapError } from "@/lib/runtime/types";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cap-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function seedIssue(projectSlug: string): number {
  // Concurrency cap joins runs to issues by project_slug, so we need real issue rows.
  const { createIssue } = require("@/lib/issues");
  return createIssue({ projectSlug, title: "x", body: "" });
}

describe("assertCapacity", () => {
  it("passes when under both caps", () => {
    expect(() => assertCapacity({ projectSlug: "qml", perProjectMax: 3, globalMax: 5 })).not.toThrow();
  });

  it("throws ConcurrencyCapError at project cap", () => {
    const i = seedIssue("qml");
    createRun({ issueId: i, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w1" });
    createRun({ issueId: i, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w2" });
    createRun({ issueId: i, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w3" });
    expect(() => assertCapacity({ projectSlug: "qml", perProjectMax: 3, globalMax: 5 }))
      .toThrow(ConcurrencyCapError);
  });

  it("throws ConcurrencyCapError at global cap even if project is under", () => {
    const a = seedIssue("a"); const b = seedIssue("b"); const c = seedIssue("c");
    const d = seedIssue("d"); const e = seedIssue("e");
    for (const i of [a, b, c, d, e]) {
      createRun({ issueId: i, agentSlug: "x", runtimeId: "claude-code", worktreePath: `/w${i}` });
    }
    expect(() => assertCapacity({ projectSlug: "a", perProjectMax: 10, globalMax: 5 }))
      .toThrow(ConcurrencyCapError);
  });
});
```

- [ ] **Step 6: Implement `concurrencyCap.ts`.**

`dashboard/lib/runtime/concurrencyCap.ts`:
```ts
import { listActiveRuns, listActiveRunsForProject } from "@/lib/runs";
import { ConcurrencyCapError } from "@/lib/runtime/types";

interface CapOpts {
  projectSlug: string;
  perProjectMax: number;
  globalMax: number;
}

export function assertCapacity(opts: CapOpts): void {
  const projectActive = listActiveRunsForProject(opts.projectSlug).length;
  if (projectActive >= opts.perProjectMax) {
    throw new ConcurrencyCapError("project", opts.perProjectMax, projectActive);
  }
  const globalActive = listActiveRuns().length;
  if (globalActive >= opts.globalMax) {
    throw new ConcurrencyCapError("global", opts.globalMax, globalActive);
  }
}

export function getCapacityStatus(opts: { projectSlug: string }): {
  projectActive: number;
  globalActive: number;
} {
  return {
    projectActive: listActiveRunsForProject(opts.projectSlug).length,
    globalActive: listActiveRuns().length,
  };
}
```

- [ ] **Step 7: Run tests.**

```bash
npm test -- concurrencyCap
```

Expected: 3 passing.

- [ ] **Step 8: Commit.**

```bash
git add dashboard/lib/runs.ts dashboard/lib/runtime/concurrencyCap.ts dashboard/tests/runs.test.ts dashboard/tests/concurrencyCap.test.ts
git commit -m "feat(runs): data layer and concurrency cap"
```

---

## Task 6: Custom server with WebSocket support

**Files:**
- Create: `dashboard/server.ts`
- Modify: `dashboard/package.json` (scripts), `dashboard/lib/runtime/claude-code.ts` (hook for inbound session_id)

The PTY needs WebSocket to stream both directions. Next.js App Router does not handle the upgrade; we wrap with a custom server.

- [ ] **Step 1: Install ws.**

```bash
cd dashboard
npm install ws@8.18.0
npm install -D @types/ws@8.5.13
```

- [ ] **Step 2: Create the live run tracker.**

`dashboard/lib/runtime/liveRuns.ts`:
```ts
import type { SpawnedRun } from "@/lib/runtime/types";
import { attachSessionId } from "@/lib/runs";

const live = new Map<number, SpawnedRun>();
const sidWaiters = new Map<number, Array<(sid: string) => void>>();

/**
 * Track a spawned run for the lifetime of its PTY. Wires the runtime's session_id
 * resolution to two consumers: (1) the runs table (via attachSessionId), and
 * (2) any callers blocked on waitForSessionId.
 */
export function registerLiveRun(runId: number, spawned: SpawnedRun): void {
  live.set(runId, spawned);
  spawned.onSessionId((sid) => {
    // (1) Persist. If notifyExternalSessionId already wrote it, this is a no-op
    // because attachSessionId is an UPDATE and the value is the same.
    try {
      attachSessionId(runId, sid);
    } catch (err) {
      console.error(`[liveRuns] failed to persist session_id for run ${runId}:`, err);
    }
    // (2) Notify external waiters.
    const list = sidWaiters.get(runId);
    if (list) {
      sidWaiters.delete(runId);
      for (const w of list) {
        try { w(sid); } catch (err) { console.error("[liveRuns] waiter threw:", err); }
      }
    }
  });
}

export function getLiveRun(runId: number): SpawnedRun | null {
  return live.get(runId) ?? null;
}

export function dropLiveRun(runId: number): void {
  const r = live.get(runId);
  if (r) {
    void r.cleanup();
    live.delete(runId);
  }
  sidWaiters.delete(runId);
}

export function listLiveRunIds(): number[] {
  return Array.from(live.keys());
}

/**
 * Called by the SessionStart hook callback endpoint when the hook posts a session_id.
 * Routes through the spawned run's notifySessionId, which converges with the jsonl
 * watch path inside the runtime. The runtime's resolved callback then fires the
 * onSessionId listener registered in registerLiveRun, which handles persistence
 * and external waiters in one place.
 */
export function notifyExternalSessionId(runId: number, sessionId: string): void {
  const spawned = live.get(runId);
  if (spawned) {
    spawned.notifySessionId(sessionId);
    return;
  }
  // The run is no longer live (ended or never registered). Persist directly so we
  // don't lose the value. No waiters can exist for a non-live run.
  try {
    attachSessionId(runId, sessionId);
  } catch (err) {
    console.error(`[liveRuns] failed to persist late session_id for run ${runId}:`, err);
  }
}

/**
 * Promise that resolves when session_id arrives for the given run. Used by
 * callers that need to block until the agent is fully addressable (e.g., the
 * "Open in terminal" button which builds `claude --resume <sid>`).
 */
export function waitForSessionId(runId: number, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onSid = (sid: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve(sid);
    };
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      const list = sidWaiters.get(runId);
      if (list) sidWaiters.set(runId, list.filter(w => w !== onSid));
      reject(new Error(`Timeout waiting for session_id on run ${runId}`));
    }, timeoutMs);
    const existing = sidWaiters.get(runId) ?? [];
    existing.push(onSid);
    sidWaiters.set(runId, existing);
  });
}
```

- [ ] **Step 3: Write `server.ts`.**

`dashboard/server.ts`:
```ts
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { getLiveRun, dropLiveRun } from "@/lib/runtime/liveRuns";
import { getRun, updateRun } from "@/lib/runs";
import { getIssue, updateIssue } from "@/lib/issues";
import { publish } from "@/lib/stream";
import { appendEvent } from "@/lib/threads";
import { openDb } from "@/lib/db";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  openDb();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "");
    const match = pathname?.match(/^\/api\/runtime\/socket\/(\d+)$/);
    if (!match) {
      socket.destroy();
      return;
    }
    const runId = parseInt(match[1], 10);
    const live = getLiveRun(runId);
    if (!live) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      // Forward PTY → WebSocket.
      const onData = (data: string) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "data", data }));
        }
      };
      const onExit = ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "exit", code: exitCode, signal }));
        }
        // Persist run end + transition issue. Guard against double-fire: this handler
        // can race with DELETE /api/runs/[id] which also calls dropLiveRun.
        const run = getRun(runId);
        if (run && run.endedAt == null) {
          // Treat code 0 as "agent finished cleanly, operator should review"; anything
          // else (non-zero exit, killed by signal) is a failure the operator can retry.
          const cleanExit = exitCode === 0 && !signal;
          const exitStatus = cleanExit ? "done" : "failed";
          const newIssueStatus = cleanExit ? "review" : "failed";

          updateRun(runId, { endedAt: Date.now(), exitStatus });

          const issue = getIssue(run.issueId);
          if (issue) {
            updateIssue(issue.id, { status: newIssueStatus });
            appendEvent({
              projectSlug: issue.projectSlug,
              issueId: issue.id,
              eventType: `run.${exitStatus}`,
              details: `Run ${runId} exited with code ${exitCode}${signal ? ` (signal ${signal})` : ""}`,
            });
            publish({ kind: "issue.changed", id: issue.id, projectSlug: issue.projectSlug, reason: "status" });
            publish({ kind: "thread.appended", issueId: issue.id });
          }
        }
        dropLiveRun(runId);
        if (ws.readyState === ws.OPEN) ws.close();
      };

      live.pty.onData(onData);
      live.pty.onExit(onExit);

      // Forward WebSocket → PTY.
      ws.on("message", (raw) => {
        let msg: any;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.type === "data" && typeof msg.data === "string") {
          live.pty.write(msg.data);
        } else if (msg.type === "resize" && typeof msg.cols === "number" && typeof msg.rows === "number") {
          live.pty.resize(msg.cols, msg.rows);
        } else if (msg.type === "close") {
          dropLiveRun(runId);
        }
      });

      ws.on("close", () => {
        // Don't kill the PTY when the WebSocket closes; the run keeps going in the background.
        // The operator can reconnect by reopening the issue drawer.
      });
    });
  });

  server.listen(port, () => {
    console.log(`[server] http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Update `package.json` scripts.**

In `dashboard/package.json`, replace the `dev` and `start` scripts:
```json
"dev": "tsx watch server.ts",
"start": "NODE_ENV=production tsx server.ts",
```

Note: `tsx watch` is the dev mode with auto-restart. If you'd rather have explicit control, use `tsx server.ts` for dev and restart manually.

- [ ] **Step 5: Smoke test the new server.**

```bash
npm run dev
```

Expected: Same as before, dashboard renders. New: `[server] http://localhost:3000` log line on boot. WebSocket endpoint won't have anything to connect to yet, but should respond with 404 on unknown run IDs (you can test with `wscat -c ws://localhost:3000/api/runtime/socket/9999` after `npm i -g wscat`).

Stop the server.

- [ ] **Step 6: Commit.**

```bash
git add dashboard/server.ts dashboard/lib/runtime/liveRuns.ts dashboard/package.json dashboard/package-lock.json
git commit -m "feat(server): custom Next server with WebSocket upgrade for /api/runtime/socket"
```

---

## Task 7: Runs API routes

**Files:**
- Create: `dashboard/app/api/runs/route.ts`, `dashboard/app/api/runs/[id]/route.ts`, `dashboard/app/api/runs/[id]/hook/route.ts`

- [ ] **Step 1: Build `api/runs/route.ts` (POST creates a run).**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";
import { getIssue, updateIssue } from "@/lib/issues";
import { getProject } from "@/lib/projects";
import { getAgent } from "@/lib/agents";
import { getRuntime } from "@/lib/runtime/registry";
import { assertCapacity } from "@/lib/runtime/concurrencyCap";
import { createRun, listRuns } from "@/lib/runs";
import { createWorktree, worktreePathFor } from "@/lib/worktrees";
import { registerLiveRun } from "@/lib/runtime/liveRuns";
import { getSettings } from "@/lib/settings";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { publish } from "@/lib/stream";
import { appendEvent } from "@/lib/threads";
import { ConcurrencyCapError } from "@/lib/runtime/types";

openDb();

const PostSchema = z.object({
  issueId: z.number().int().positive(),
});

export async function POST(req: Request) {
  await ensureServerBooted();

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  const issue = getIssue(parsed.data.issueId);
  if (!issue) return NextResponse.json({ error: "issue not found" }, { status: 404 });
  if (!issue.assigneeSlug) return NextResponse.json({ error: "issue has no assignee" }, { status: 400 });

  const project = getProject(issue.projectSlug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const agent = getAgent(issue.assigneeSlug);
  if (!agent) return NextResponse.json({ error: "assignee agent not found" }, { status: 404 });

  const runtimeId = agent.runtime || project["runtime-default"];
  const runtime = getRuntime(runtimeId);
  if (!runtime) return NextResponse.json({ error: `runtime not registered: ${runtimeId}` }, { status: 500 });

  const settings = getSettings();
  try {
    assertCapacity({
      projectSlug: project.slug,
      perProjectMax: settings.concurrency.perProjectMax,
      globalMax: settings.concurrency.globalMax,
    });
  } catch (err) {
    if (err instanceof ConcurrencyCapError) {
      return NextResponse.json(
        { error: err.message, scope: err.scope, cap: err.cap, active: err.active },
        { status: 429 }
      );
    }
    throw err;
  }

  const worktreePath = worktreePathFor(settings.workspaceRoot, project.slug, issue.id);
  try {
    createWorktree({
      sourceRepoPath: project.path,
      worktreePath,
      branchName: `agentic-os/issue-${issue.id}`,
    });
  } catch (err) {
    return NextResponse.json({ error: `worktree creation failed: ${(err as Error).message}` }, { status: 500 });
  }

  const runId = createRun({
    issueId: issue.id,
    agentSlug: agent.slug,
    runtimeId,
    worktreePath,
  });

  try {
    const spawned = await runtime.spawn({
      worktreePath,
      initialPrompt: `${issue.title}\n\n${issue.body}`.trim(),
      runId,
      issueId: issue.id,
      projectSlug: project.slug,
    });
    registerLiveRun(runId, spawned);
  } catch (err) {
    return NextResponse.json({ error: `spawn failed: ${(err as Error).message}` }, { status: 500 });
  }

  updateIssue(issue.id, { status: "running" });
  appendEvent({
    projectSlug: project.slug,
    issueId: issue.id,
    eventType: "run.started",
    details: `Run ${runId} started against ${agent.slug} via ${runtimeId} at ${worktreePath}`,
  });
  publish({ kind: "issue.changed", id: issue.id, projectSlug: project.slug, reason: "status" });
  publish({ kind: "thread.appended", issueId: issue.id });

  return NextResponse.json({ runId, worktreePath }, { status: 201 });
}

export async function GET(req: Request) {
  await ensureServerBooted();
  const { searchParams } = new URL(req.url);
  const issueIdParam = searchParams.get("issueId");
  if (!issueIdParam) return NextResponse.json({ error: "issueId required" }, { status: 400 });
  const issueId = parseInt(issueIdParam, 10);
  return NextResponse.json({ runs: listRuns({ issueId }) });
}
```

- [ ] **Step 2: Build `api/runs/[id]/route.ts` (GET, DELETE = stop).**

```ts
import { NextResponse } from "next/server";
import { getRun, updateRun } from "@/lib/runs";
import { getIssue, updateIssue } from "@/lib/issues";
import { dropLiveRun } from "@/lib/runtime/liveRuns";
import { publish } from "@/lib/stream";
import { appendEvent } from "@/lib/threads";
import { openDb } from "@/lib/db";

openDb();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  const run = getRun(n);
  return run ? NextResponse.json(run) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);
  const run = getRun(n);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (run.endedAt != null) return NextResponse.json({ error: "already ended" }, { status: 409 });

  dropLiveRun(n);
  updateRun(n, { endedAt: Date.now(), exitStatus: "stopped" });
  updateIssue(run.issueId, { status: "failed" });

  const issue = getIssue(run.issueId);
  if (issue) {
    appendEvent({
      projectSlug: issue.projectSlug,
      issueId: issue.id,
      eventType: "run.stopped",
      details: `Run ${n} stopped by operator`,
    });
    publish({ kind: "issue.changed", id: issue.id, projectSlug: issue.projectSlug, reason: "status" });
    publish({ kind: "thread.appended", issueId: issue.id });
  }
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 3: Build `api/runs/[id]/hook/route.ts` (SessionStart callback).**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRun, updateRun } from "@/lib/runs";
import { notifyExternalSessionId } from "@/lib/runtime/liveRuns";
import { openDb } from "@/lib/db";

openDb();

const Schema = z.object({
  runId: z.number().int().positive(),
  sessionId: z.string().min(1),
  transcriptPath: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = parseInt(id, 10);

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  if (parsed.data.runId !== n) return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  if (!getRun(n)) return NextResponse.json({ error: "run not found" }, { status: 404 });

  // notifyExternalSessionId routes through spawned.notifySessionId, which fires
  // the onSessionId listener that registerLiveRun installed. That listener calls
  // attachSessionId on the runs table. If the run is no longer live (already ended
  // when the hook callback arrives late), notifyExternalSessionId persists directly.
  // Either way, the runs.pty_session_id column ends up correct.
  notifyExternalSessionId(n, parsed.data.sessionId);
  if (parsed.data.transcriptPath) {
    updateRun(n, { transcriptPath: parsed.data.transcriptPath });
  }
  console.log(`[hook] run ${n}: session_id=${parsed.data.sessionId}, transcript=${parsed.data.transcriptPath ?? "none"}`);
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Smoke-test the create flow.**

```bash
npm run dev
```

You'll need a real issue with an assignee that maps to an agent that exists. The QML issue from Phase 2 if it's still there; otherwise create one. Then:

```bash
# Assuming issue id N exists, assigned to lit-reviewer, against project with valid path:
curl -s -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{"issueId":N}'
```

Expected: `{"runId":1,"worktreePath":"..."}`. Worktree appears at `<workspaceRoot>/<slug>/.worktrees/issue-N/`. Issue status moves to "running". `claude` is running in the background (you can see it with `ps aux | grep claude`).

Stop the run:
```bash
curl -s -X DELETE http://localhost:3000/api/runs/1 -w "%{http_code}\n"
```

Expected: 204. The `claude` process disappears. Issue status moves to "failed".

Remove the worktree manually for cleanup (worktree management UI comes in Task 14):
```bash
cd <project-path>
git worktree remove .worktrees/issue-N --force || git worktree prune
```

- [ ] **Step 5: Commit.**

```bash
git add dashboard/app/api/runs/
git commit -m "feat(api): /api/runs CRUD with worktree creation and PTY spawn"
```

---

## Task 8: xterm.js client setup

**Files:**
- Modify: `dashboard/package.json` (add xterm packages)
- Create: `dashboard/components/issue/RunTerminal.tsx`

- [ ] **Step 1: Install xterm packages.**

```bash
cd dashboard
npm install xterm@5.5.0 xterm-addon-fit@0.10.0 xterm-addon-web-links@0.11.0
```

- [ ] **Step 2: Build the terminal component.**

`dashboard/components/issue/RunTerminal.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";

interface Props {
  runId: number;
  active: boolean; // when false, don't auto-scroll on output
}

export function RunTerminal({ runId, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Liberation Mono", monospace',
      fontSize: 13,
      theme: {
        background: "#0b0b0d",
        foreground: "#e6e6e6",
        cursor: "#e6e6e6",
      },
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/api/runtime/socket/${runId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "data") term.write(msg.data);
        else if (msg.type === "exit") {
          term.write(`\r\n[Process exited with code ${msg.code}]\r\n`);
        }
      } catch {
        // ignore
      }
    };
    ws.onclose = () => {
      term.write("\r\n[Disconnected]\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "data", data }));
      }
    });

    const onResize = () => {
      try {
        fit.fit();
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      try { ws.close(); } catch {}
      try { term.dispose(); } catch {}
      termRef.current = null;
      wsRef.current = null;
      fitRef.current = null;
    };
  }, [runId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] rounded-md border border-gray-300 dark:border-gray-700 bg-black"
    />
  );
}
```

- [ ] **Step 3: Commit.**

```bash
git add dashboard/components/issue/RunTerminal.tsx dashboard/package.json dashboard/package-lock.json
git commit -m "feat(dashboard): xterm.js terminal component for run output"
```

---

## Task 9: Runs tab in the issue drawer

**Files:**
- Create: `dashboard/components/issue/RunsTab.tsx`, `dashboard/components/issue/RunHeader.tsx`, `dashboard/components/issue/StartButton.tsx`, `dashboard/components/issue/StopButton.tsx`
- Create: `dashboard/hooks/useRun.ts`
- Modify: `dashboard/components/issue/IssueDrawer.tsx` (replace RunsTabStub usage)

- [ ] **Step 1: Build `hooks/useRun.ts`.**

```ts
// dashboard/hooks/useRun.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";

export interface RunData {
  id: number;
  issueId: number;
  agentSlug: string;
  runtimeId: string;
  worktreePath: string;
  ptySessionId: string | null;
  startedAt: number;
  endedAt: number | null;
  exitStatus: string | null;
}

export function useRunsForIssue(issueId: number) {
  const [runs, setRuns] = useState<RunData[] | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/runs?issueId=${issueId}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setRuns(data.runs);
  }, [issueId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "issue.changed" && (event as any).id === issueId) reload();
  });

  // Poll for session_id updates and exit transitions every 2s as backup.
  useEffect(() => {
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [reload]);

  return { runs, reload };
}
```

- [ ] **Step 2: Build `RunHeader.tsx`.**

```tsx
"use client";
import clsx from "clsx";
import type { RunData } from "@/hooks/useRun";

interface Props {
  run: RunData;
  onOpenInTerminal: () => void;
}

export function RunHeader({ run, onOpenInTerminal }: Props) {
  const isActive = run.endedAt == null;
  const status = isActive
    ? "running"
    : run.exitStatus ?? (run.endedAt != null ? "ended" : "unknown");

  return (
    <div className="flex items-center justify-between text-xs font-mono bg-gray-100 dark:bg-gray-900 rounded-md p-2 mb-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className={clsx(
          "px-1.5 py-0.5 rounded font-sans",
          isActive ? "bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-100" : "bg-gray-200 dark:bg-gray-800"
        )}>
          {status}
        </span>
        <span>#{run.id}</span>
        <span className="truncate" title={run.worktreePath}>{run.worktreePath}</span>
        {run.ptySessionId && (
          <span className="text-gray-500" title={run.ptySessionId}>session: {run.ptySessionId.slice(0, 8)}</span>
        )}
      </div>
      <button
        onClick={onOpenInTerminal}
        disabled={!run.ptySessionId}
        className={clsx(
          "text-xs px-2 py-0.5 rounded font-sans",
          run.ptySessionId
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
        )}
        title={run.ptySessionId ? "Open in external terminal" : "Waiting for session ID"}
      >
        Open in terminal
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Build `StartButton.tsx`.**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/common/Button";

interface Props {
  issueId: number;
  disabled: boolean;
  disabledReason: string | null;
  onStarted: () => void;
}

export function StartButton({ issueId, disabled, disabledReason, onStarted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onStarted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        variant="primary"
        onClick={start}
        disabled={busy || disabled}
        title={disabledReason ?? undefined}
      >
        {busy ? "Starting..." : "Start"}
      </Button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Build `StopButton.tsx`.**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/common/Button";

interface Props {
  runId: number;
  onStopped: () => void;
}

export function StopButton({ runId, onStopped }: Props) {
  const [busy, setBusy] = useState(false);

  async function stop() {
    if (!confirm("Stop the running agent? This cannot be resumed.")) return;
    setBusy(true);
    try {
      await fetch(`/api/runs/${runId}`, { method: "DELETE" });
      onStopped();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="danger" onClick={stop} disabled={busy}>
      {busy ? "Stopping..." : "Stop"}
    </Button>
  );
}
```

- [ ] **Step 5: Build `RunsTab.tsx`.**

```tsx
"use client";
import { useRunsForIssue } from "@/hooks/useRun";
import { RunTerminal } from "./RunTerminal";
import { RunHeader } from "./RunHeader";
import { StartButton } from "./StartButton";
import { StopButton } from "./StopButton";

interface Props {
  issueId: number;
  projectSlug: string;
  issueStatus: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  hasAssignee: boolean;
}

export function RunsTab({ issueId, projectSlug, issueStatus, hasAssignee }: Props) {
  const { runs, reload } = useRunsForIssue(issueId);

  if (!runs) return <p className="text-sm text-gray-400">Loading runs...</p>;

  const activeRun = runs.find(r => r.endedAt == null);
  const startDisabled = !hasAssignee || (activeRun != null) || issueStatus === "done";
  const disabledReason = !hasAssignee
    ? "Assign an agent before starting"
    : activeRun != null
    ? "Run already in progress"
    : issueStatus === "done"
    ? "Issue is marked done"
    : null;

  async function openInTerminal(runId: number) {
    const res = await fetch(`/api/runs/${runId}/open-terminal`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to open terminal: ${data.error ?? res.status}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {runs.length === 0 ? "No runs yet." : `${runs.length} run${runs.length === 1 ? "" : "s"}`}
        </div>
        <div className="flex items-center gap-2">
          {activeRun && <StopButton runId={activeRun.id} onStopped={reload} />}
          <StartButton
            issueId={issueId}
            disabled={startDisabled}
            disabledReason={disabledReason}
            onStarted={reload}
          />
        </div>
      </div>

      {activeRun && (
        <section>
          <RunHeader run={activeRun} onOpenInTerminal={() => openInTerminal(activeRun.id)} />
          <RunTerminal runId={activeRun.id} active />
        </section>
      )}

      {runs.filter(r => r.endedAt != null).length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Previous runs</h4>
          <ul className="space-y-2">
            {runs.filter(r => r.endedAt != null).map(r => (
              <li key={r.id} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                #{r.id} {r.exitStatus} ({new Date(r.startedAt).toLocaleString()} → {r.endedAt ? new Date(r.endedAt).toLocaleString() : "?"})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add the capacity endpoint.**

`dashboard/app/api/projects/[slug]/capacity/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getCapacityStatus } from "@/lib/runtime/concurrencyCap";
import { openDb } from "@/lib/db";

openDb();

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return NextResponse.json(getCapacityStatus({ projectSlug: slug }));
}
```

- [ ] **Step 7: Wire `RunsTab` into the issue drawer.**

In `dashboard/components/issue/IssueDrawer.tsx`, replace the `<RunsTabStub />` usage with:
```tsx
<RunsTab
  issueId={issue.id}
  projectSlug={issue.projectSlug}
  issueStatus={issue.status}
  hasAssignee={issue.assigneeSlug != null}
/>
```

And update the import:
```tsx
import { RunsTab } from "./RunsTab";
// Remove: import { RunsTabStub } from "./RunsTabStub";
```

You can delete `RunsTabStub.tsx` now or leave it; it's no longer imported anywhere.

- [ ] **Step 8: Full smoke test.**

```bash
npm run dev
```

Open the QML project, open the existing issue. The Runs section now shows "No runs yet" and a Start button. With an assignee set, the Start button is enabled.

DO NOT click Start yet unless you're ready to actually spawn `claude`. Task 10 brings it all together with verification.

- [ ] **Step 9: Commit.**

```bash
git add dashboard/components/issue/ dashboard/hooks/useRun.ts dashboard/app/api/projects/[slug]/capacity/
git commit -m "feat(dashboard): Runs tab with start/stop, xterm.js wired"
```

---

## Task 10: First end-to-end run

This task is the headline of Phase 3. It is integration, not new code. Everything wired in Tasks 1 through 9 has to work together: browser → WebSocket → custom server → registry → node-pty → claude CLI → SessionStart hook → callback endpoint → DB → SSE → browser. Seven layers. When something fails, you need to know which layer broke.

Per `superpowers:systematic-debugging`, the rule is: instrument boundaries BEFORE first run, not after the first failure. Step 1 below adds structured logging at each layer. The instrumentation stays in the codebase permanently; it costs nothing in production and saves hours when something drifts.

**Files:**
- Modify: `dashboard/lib/runtime/claude-code.ts` (add boundary logs)
- Modify: `dashboard/app/api/runs/route.ts` (add boundary logs)
- Modify: `dashboard/server.ts` (add boundary logs)
- Modify: `dashboard/scripts/claude-session-hook.js` (add stderr trace)

- [ ] **Step 1: Add boundary instrumentation at every layer.**

In `dashboard/app/api/runs/route.ts`, add log statements at the top of POST and after each major step. Replace the body of the POST handler from the assertCapacity try block through the end with this version:

```ts
  console.log(`[runs.POST] issueId=${parsed.data.issueId}`);

  const settings = getSettings();
  try {
    assertCapacity({
      projectSlug: project.slug,
      perProjectMax: settings.concurrency.perProjectMax,
      globalMax: settings.concurrency.globalMax,
    });
  } catch (err) {
    if (err instanceof ConcurrencyCapError) {
      console.log(`[runs.POST] cap hit: ${err.scope} ${err.active}/${err.cap}`);
      return NextResponse.json(
        { error: err.message, scope: err.scope, cap: err.cap, active: err.active },
        { status: 429 }
      );
    }
    throw err;
  }

  const worktreePath = worktreePathFor(settings.workspaceRoot, project.slug, issue.id);
  console.log(`[runs.POST] creating worktree at ${worktreePath} from ${project.path}`);
  try {
    createWorktree({
      sourceRepoPath: project.path,
      worktreePath,
      branchName: `agentic-os/issue-${issue.id}`,
    });
  } catch (err) {
    console.error(`[runs.POST] worktree creation failed:`, err);
    return NextResponse.json({ error: `worktree creation failed: ${(err as Error).message}` }, { status: 500 });
  }

  const runId = createRun({
    issueId: issue.id,
    agentSlug: agent.slug,
    runtimeId,
    worktreePath,
  });
  console.log(`[runs.POST] created run ${runId}; spawning ${runtimeId}`);

  try {
    const spawned = await runtime.spawn({
      worktreePath,
      initialPrompt: `${issue.title}\n\n${issue.body}`.trim(),
      runId,
      issueId: issue.id,
      projectSlug: project.slug,
    });
    registerLiveRun(runId, spawned);
    console.log(`[runs.POST] spawn complete for run ${runId}, PTY pid=${spawned.pty.pid}`);
  } catch (err) {
    console.error(`[runs.POST] spawn failed for run ${runId}:`, err);
    return NextResponse.json({ error: `spawn failed: ${(err as Error).message}` }, { status: 500 });
  }

  updateIssue(issue.id, { status: "running" });
  appendEvent({
    projectSlug: project.slug,
    issueId: issue.id,
    eventType: "run.started",
    details: `Run ${runId} started against ${agent.slug} via ${runtimeId} at ${worktreePath}`,
  });
  publish({ kind: "issue.changed", id: issue.id, projectSlug: project.slug, reason: "status" });
  publish({ kind: "thread.appended", issueId: issue.id });

  return NextResponse.json({ runId, worktreePath }, { status: 201 });
}
```

In `dashboard/lib/runtime/claude-code.ts`, at the top of `spawnClaude` add:
```ts
  console.log(`[claude-code.spawn] run ${opts.runId}: cwd=${opts.worktreePath}, prompt length=${opts.initialPrompt.length}`);
```

And inside `fireSessionId` add the first line:
```ts
  function fireSessionId(sid: string) {
    if (resolvedSid !== null) return;
    console.log(`[claude-code] run ${opts.runId}: session_id resolved = ${sid}`);
    resolvedSid = sid;
    // ... rest unchanged
```

And inside the `setTimeout` for the initial prompt:
```ts
    try {
      const body = opts.initialPrompt.trim();
      if (body.length > 0) {
        console.log(`[claude-code] run ${opts.runId}: writing initial prompt (${body.length} chars) to PTY`);
        term.write(body + "\r");
      }
    } catch (err) {
      console.error(`[claude-code] run ${opts.runId}: PTY write failed:`, err);
    }
```

In `dashboard/server.ts`, inside the upgrade handler:
```ts
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "");
    const match = pathname?.match(/^\/api\/runtime\/socket\/(\d+)$/);
    if (!match) {
      console.log(`[ws] non-runtime upgrade rejected: ${pathname}`);
      socket.destroy();
      return;
    }
    const runId = parseInt(match[1], 10);
    const live = getLiveRun(runId);
    if (!live) {
      console.log(`[ws] run ${runId} not live, returning 404`);
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    console.log(`[ws] run ${runId} connected`);
    wss.handleUpgrade(req, socket, head, (ws) => {
      // ... rest unchanged
```

And inside the `onExit` handler at the very top:
```ts
      const onExit = ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        console.log(`[server.onExit] run ${runId}: exitCode=${exitCode}, signal=${signal ?? "none"}`);
        // ... rest unchanged
```

In `dashboard/scripts/claude-session-hook.js`, add a stderr trace just inside the `process.stdin.on("end", ...)` callback:
```js
process.stdin.on("end", () => {
  // stderr is fine to write to; SessionStart's stdout becomes injected context, but stderr is free.
  process.stderr.write(`[claude-session-hook] fired, raw bytes=${raw.length}\n`);
  // ... rest unchanged
```

Verify the file compiles (TypeScript files only):
```bash
cd dashboard
npx tsc --noEmit
```

Expected: no errors. If there are errors, fix them before continuing. Do not skip this check; the next steps assume everything compiles.

- [ ] **Step 2: Verify pre-conditions for the run.**

Confirm by inspecting the dashboard:
- The QML project (or any test project) is in the dashboard.
- Its `path:` frontmatter points to a real git repo on disk. Confirm with `ls -la $(grep '^path:' vault/projects/<slug>/PROJECT.md | awk '{print $2}')/.git`.
- At least one agent is in its crew, visible in the crew sidebar.
- An issue is filed against it with an assignee. The Start button in the issue drawer is enabled.

Also verify `claude` is on PATH from inside the project directory:
```bash
cd <project-path>
claude --version
```

If `claude` is on your PATH globally but not when invoked from the project directory, the PTY spawn will fail. Confirm both contexts work.

- [ ] **Step 3: Start the dashboard with logs visible.**

```bash
cd dashboard
npm run dev 2>&1 | tee /tmp/agentic-os-run-1.log
```

The `tee` keeps a copy of everything for post-run analysis. Wait for `[server] http://localhost:3000` before opening the browser.

- [ ] **Step 4: In a second shell, tail `claude`'s side.**

```bash
# This catches anything the hook script writes to stderr.
tail -f ~/.claude/projects/*/.*.log 2>/dev/null &
ls ~/.claude/projects/  # initial state, note what's there
```

Make a mental note of which jsonl files exist before the run. The new one that appears during the run is your session_id.

- [ ] **Step 5: Open the issue and click Start.**

In the browser:
1. Navigate to the project.
2. Open the issue.
3. Scroll to the Runs section.
4. Click Start.

What you should see in the `/tmp/agentic-os-run-1.log` over the next 10 to 30 seconds, in order:

```
[runs.POST] issueId=N
[runs.POST] creating worktree at /ws/<slug>/.worktrees/issue-N from /path/to/repo
[runs.POST] created run M; spawning claude-code
[claude-code.spawn] run M: cwd=/ws/<slug>/.worktrees/issue-N, prompt length=L
[runs.POST] spawn complete for run M, PTY pid=PID
[ws] run M connected
[claude-code] run M: writing initial prompt (L chars) to PTY
[claude-session-hook] fired, raw bytes=B          (stderr from hook script, may appear out of order)
[hook] run M: session_id=UUID, transcript=...
[claude-code] run M: session_id resolved = UUID
```

And in the browser:
1. Status pill turns to "running" within ~1s of clicking Start.
2. xterm.js terminal appears in the Runs section.
3. `claude` initializes inside the worktree; the TUI renders.
4. After ~1.2s, the issue's body is typed automatically into the prompt.
5. The agent starts working.
6. Within ~30s, the session ID appears in the RunHeader (`session: a1b2c3d4`).
7. The "Open in terminal" button becomes enabled.

**If any layer's log line is missing, that's your failure point.** Use the diagnosis tree in Step 6.

- [ ] **Step 6: If something failed, use this diagnosis tree.**

| Last log line seen | Failure point | Likely cause | First thing to try |
|---|---|---|---|
| (no `[runs.POST]`) | Browser to API | The Start button's fetch is hitting a bad URL or the dev server isn't routing. | Open browser devtools Network tab; confirm POST /api/runs returns 201. |
| `[runs.POST] issueId=N` only | Validation (issue, project, agent, runtime, capacity) | One of the lookups returned null. | Check the response body in devtools; it has the error string. |
| `[runs.POST] creating worktree...` | git worktree creation | Branch already exists or path is occupied. | Run `git worktree list` inside `<project-path>`; clean up if needed. |
| `[runs.POST] created run M; spawning claude-code` | claude-code.spawn | node-pty failed to spawn `claude`. | Check `/tmp/agentic-os-run-1.log` for "Error: spawn claude ENOENT". If yes, `claude` not on PATH for the server process; restart `npm run dev` from a shell where it is. |
| `[claude-code.spawn]` but no `[runs.POST] spawn complete` | Inside spawnClaude before return | hookInstaller, jsonl watcher init, or PTY constructor threw. | Look at the error line right after the last log. |
| `[runs.POST] spawn complete` but xterm shows `[Disconnected]` | Browser to WebSocket | server.ts upgrade handler rejected. | Check for `[ws]` lines. If you see `not live, returning 404`, the run id mismatch is between the browser and server. If no `[ws]` line, the WS request isn't reaching the server. |
| `[ws] run M connected` but xterm is blank | PTY data flow | PTY started but produced no output. | Run `ps aux \| grep claude` to confirm the process exists. If it does, claude is hung; check that it's not waiting for input. |
| xterm renders but `[claude-code] writing initial prompt` never fires | setTimeout ate the error | Empty body or term.write threw silently. | Add an `else console.log("empty prompt skipped")` branch. |
| Initial prompt logged but agent didn't act on it | Timing | 1200ms wasn't enough to reach prompt-ready. | Bump `PROMPT_READY_DELAY_MS` to 2500 and rerun. |
| No `[claude-session-hook] fired` and no `[hook] run M: session_id=` after 30s | SessionStart hook didn't fire | Hook script path wrong, settings.local.json malformed, or the known hook bug (#10373). | The jsonl watch should still win. If neither fires, check `<worktreePath>/.claude/settings.local.json` exists and the `command` field is correct. |
| Both paths timed out but `~/.claude/projects/<encoded-cwd>/` has a new .jsonl file | jsonl watch failed | chokidar didn't see the file. | Verify the encoded-cwd path matches what `defaultProjectsRoot()` looks at; `claude` sometimes uses a different encoding than expected. |
| `[claude-code] session_id resolved =` fires but RunHeader doesn't update | SSE or React state | The 2s poll in `useRun` should catch this within 2s; if it doesn't, check the API GET /api/runs/:id response. | Reload the page; the run state should hydrate from the API. |

Each failure mode has a single first-action fix; if that fix doesn't work, go to systematic-debugging.

- [ ] **Step 7: Type into the terminal.**

Once everything works through Step 5, click into the xterm area and type something. The character should appear in the terminal and the agent should see your input.

This is the bidirectional check. If typing doesn't reach the PTY, the `ws.on("message", ...)` handler in server.ts isn't matching the `{type: "data", data: ...}` shape. Check the browser devtools WebSocket frame inspector.

- [ ] **Step 8: Click Stop.**

The terminal shows `[Disconnected]`. The `claude` process exits (verify with `ps aux | grep claude` shows nothing). Issue status moves to "failed". The thread shows an event `run.stopped`.

Expected new log lines:
```
[server.onExit] run M: exitCode=<some-code>, signal=<SIGKILL or similar>
```

- [ ] **Step 9: Clean up the worktree manually.**

```bash
cd <project-path>
git worktree remove .worktrees/issue-<id> --force
git branch -D agentic-os/issue-<id>
```

(Or wait for Task 14's worktree management UI.)

- [ ] **Step 10: Tag the milestone.**

If everything worked, you've achieved the headline of Phase 3: an agent ran end-to-end. Mark it:
```bash
cd ..
git tag -a path-a-phase-3-mvp -m "First successful end-to-end agent run in Path A rebuild"
```

- [ ] **Step 11: Commit the instrumentation.**

The boundary logs added in Step 1 stay permanently. Commit them:
```bash
git add dashboard/app/api/runs/route.ts dashboard/lib/runtime/claude-code.ts dashboard/server.ts dashboard/scripts/claude-session-hook.js
git commit -m "feat(runtime): boundary instrumentation across run lifecycle"
```

If Step 5 failed and you debugged your way to working, also commit whatever fix you applied with a separate message capturing what was wrong (future you will want to know).

---

## Task 11: Verify run lifecycle on clean and dirty exits

The PTY exit handler in `server.ts` (Task 6, with the corrections from Task 10's boundary logs) handles both clean exit (code 0 → issue moves to review) and dirty exit (non-zero or signal → issue moves to failed). This task is verification only: red-green confirm both paths fire correctly.

**Files:** none modified.

- [ ] **Step 1: Run a short-lived agent task and let it exit cleanly.**

In the dashboard, create a new test issue with a trivial body that the agent can complete quickly. Something like: "Read README.md and respond with a one-sentence summary. Do not edit any files."

Assign it, click Start. Watch the xterm. When the agent finishes its response, type `/exit` (or `Ctrl+D`, or however the operator typically ends a claude session) to close cleanly.

Expected log line in `/tmp/agentic-os-run-1.log`:
```
[server.onExit] run M: exitCode=0, signal=none
```

Expected dashboard state:
- Issue status: "review"
- Run row's `endedAt`: set
- Run row's `exitStatus`: "done"
- Thread has a new event: "run.done"

Verify the DB directly:
```bash
sqlite3 dashboard/state.db "SELECT id, exit_status, ended_at FROM runs WHERE issue_id = N ORDER BY id DESC LIMIT 1;"
```

- [ ] **Step 2: Run another and force a non-zero exit.**

Create another test issue, Start it. Once `claude` is running, kill the process from another shell:
```bash
ps aux | grep '[c]laude' | head -1 | awk '{print $2}' | xargs kill -TERM
```

Expected log line:
```
[server.onExit] run M: exitCode=143, signal=15
```
(Or similar, depending on how your kernel reports SIGTERM. The point is `cleanExit` evaluates to false.)

Expected dashboard state:
- Issue status: "failed"
- Run row's `exitStatus`: "failed"
- Thread has a new event: "run.failed"

- [ ] **Step 3: No commit needed if Steps 1 and 2 both pass.**

The handler is correct from Task 6. Task 11 just confirms it. If either step revealed a bug, return to Task 6 Step 3 and fix in place; commit the fix with a message naming the specific case (clean exit vs signal exit) that was broken.

---

## Task 12: Concurrency cap UI feedback

**Files:**
- Create: `dashboard/app/api/settings/route.ts`
- Replace: `dashboard/components/issue/RunsTab.tsx` (full rewrite to include cap state)

The Start button needs to surface why it's disabled when the system is at a cap. This adds a read-only settings endpoint and replaces RunsTab with the full version that consumes it.

- [ ] **Step 1: Add the read-only settings API.**

`dashboard/app/api/settings/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export async function GET() {
  // Read-only. Settings are edited directly in the JSON file for now;
  // a write endpoint and UI ship in Phase 6.
  return NextResponse.json(getSettings());
}
```

- [ ] **Step 2: Replace `RunsTab.tsx` with the cap-aware version.**

Replace the entire contents of `dashboard/components/issue/RunsTab.tsx` with:

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRunsForIssue } from "@/hooks/useRun";
import { RunTerminal } from "./RunTerminal";
import { RunHeader } from "./RunHeader";
import { StartButton } from "./StartButton";
import { StopButton } from "./StopButton";

interface Props {
  issueId: number;
  projectSlug: string;
  issueStatus: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  hasAssignee: boolean;
}

interface CapState {
  projectActive: number;
  globalActive: number;
}

interface CapLimits {
  perProjectMax: number;
  globalMax: number;
}

export function RunsTab({ issueId, projectSlug, issueStatus, hasAssignee }: Props) {
  const { runs, reload } = useRunsForIssue(issueId);
  const [capStatus, setCapStatus] = useState<CapState | null>(null);
  const [capLimits, setCapLimits] = useState<CapLimits | null>(null);

  const refreshCaps = useCallback(async () => {
    const [capRes, settingsRes] = await Promise.all([
      fetch(`/api/projects/${projectSlug}/capacity`, { cache: "no-store" }),
      fetch(`/api/settings`, { cache: "no-store" }),
    ]);
    if (capRes.ok) setCapStatus(await capRes.json());
    if (settingsRes.ok) {
      const s = await settingsRes.json();
      setCapLimits({
        perProjectMax: s.concurrency.perProjectMax,
        globalMax: s.concurrency.globalMax,
      });
    }
  }, [projectSlug]);

  useEffect(() => {
    refreshCaps();
  }, [refreshCaps, runs?.length]);

  if (!runs) return <p className="text-sm text-gray-400">Loading runs...</p>;

  const activeRun = runs.find(r => r.endedAt == null);

  const atProjectCap = capLimits != null && capStatus != null && capStatus.projectActive >= capLimits.perProjectMax;
  const atGlobalCap = capLimits != null && capStatus != null && capStatus.globalActive >= capLimits.globalMax;

  const capReason = atProjectCap
    ? `At project concurrency cap (${capStatus!.projectActive}/${capLimits!.perProjectMax})`
    : atGlobalCap
    ? `At global concurrency cap (${capStatus!.globalActive}/${capLimits!.globalMax})`
    : null;

  const startDisabled =
    !hasAssignee ||
    activeRun != null ||
    issueStatus === "done" ||
    capReason != null;

  const disabledReason = !hasAssignee
    ? "Assign an agent before starting"
    : activeRun != null
    ? "Run already in progress"
    : issueStatus === "done"
    ? "Issue is marked done"
    : capReason;

  async function openInTerminal(runId: number) {
    const res = await fetch(`/api/runs/${runId}/open-terminal`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to open terminal: ${data.error ?? res.status}`);
    }
  }

  function onStarted() {
    reload();
    refreshCaps();
  }

  function onStopped() {
    reload();
    refreshCaps();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {runs.length === 0 ? "No runs yet." : `${runs.length} run${runs.length === 1 ? "" : "s"}`}
        </div>
        <div className="flex items-center gap-2">
          {activeRun && <StopButton runId={activeRun.id} onStopped={onStopped} />}
          <StartButton
            issueId={issueId}
            disabled={startDisabled}
            disabledReason={disabledReason}
            onStarted={onStarted}
          />
        </div>
      </div>

      {activeRun && (
        <section>
          <RunHeader run={activeRun} onOpenInTerminal={() => openInTerminal(activeRun.id)} />
          <RunTerminal runId={activeRun.id} active />
        </section>
      )}

      {runs.filter(r => r.endedAt != null).length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Previous runs</h4>
          <ul className="space-y-2">
            {runs.filter(r => r.endedAt != null).map(r => (
              <li key={r.id} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                #{r.id} {r.exitStatus} ({new Date(r.startedAt).toLocaleString()} → {r.endedAt ? new Date(r.endedAt).toLocaleString() : "?"})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify cap enforcement end to end.**

```bash
npm run dev
```

Create three issues in the same project, each with an assignee. Start each one (they spawn real `claude` processes; have a coffee). After the third starts, open a fourth issue; its Start button should be disabled with the tooltip showing the project cap. Then start issues against a different project until the global cap (5) is hit. The next Start across any project should be disabled with the global cap reason.

Stop all running runs (Stop button on each) to clean up. Then `git -C <project-path> worktree list` to confirm the worktrees still exist for inspection.

- [ ] **Step 4: Commit.**

```bash
git add dashboard/components/issue/RunsTab.tsx dashboard/app/api/settings/
git commit -m "feat(dashboard): show concurrency cap status in Start button tooltip"
```

---

## Task 13: Open in terminal escape hatch

**Files:**
- Create: `dashboard/lib/terminal/openExternal.ts`, `dashboard/app/api/runs/[id]/open-terminal/route.ts`

- [ ] **Step 1: Implement `openExternal.ts`.**

```ts
// dashboard/lib/terminal/openExternal.ts
import { spawn } from "node:child_process";
import os from "node:os";

interface OpenOpts {
  cwd: string;
  command: string;
}

/**
 * Open the operator's preferred terminal at the given cwd, running the given command.
 * Platform detection: Windows uses wt.exe, macOS uses iTerm (falls back to Terminal.app), Linux uses $TERMINAL or gnome-terminal.
 */
export function openExternalTerminal(opts: OpenOpts): { ok: boolean; error?: string } {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      // Windows Terminal: wt.exe -d <cwd> <command>
      // wt.exe parses its args specially; pass the command as a single string after `--`.
      spawn("wt.exe", ["-d", opts.cwd, "cmd.exe", "/k", opts.command], { detached: true, stdio: "ignore" }).unref();
      return { ok: true };
    }

    if (platform === "darwin") {
      // iTerm is preferred if installed; fall back to Terminal.app via osascript.
      const fs = require("node:fs");
      const iterm = "/Applications/iTerm.app";
      if (fs.existsSync(iterm)) {
        const script = `
          tell application "iTerm"
            activate
            create window with default profile
            tell current session of current window
              write text "cd ${shellEscape(opts.cwd)} && ${opts.command}"
            end tell
          end tell
        `;
        spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" }).unref();
      } else {
        const script = `
          tell application "Terminal"
            do script "cd ${shellEscape(opts.cwd)} && ${opts.command}"
            activate
          end tell
        `;
        spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" }).unref();
      }
      return { ok: true };
    }

    // Linux / WSL
    const term = process.env.TERMINAL;
    if (term) {
      spawn(term, ["-e", "bash", "-c", `cd '${opts.cwd}' && ${opts.command}; exec bash`], {
        detached: true,
        stdio: "ignore",
      }).unref();
      return { ok: true };
    }
    // Try common terminals in order.
    for (const candidate of ["gnome-terminal", "konsole", "xterm", "alacritty"]) {
      try {
        if (candidate === "gnome-terminal") {
          spawn("gnome-terminal", ["--working-directory", opts.cwd, "--", "bash", "-c", `${opts.command}; exec bash`], {
            detached: true,
            stdio: "ignore",
          }).unref();
        } else if (candidate === "konsole") {
          spawn("konsole", ["--workdir", opts.cwd, "-e", "bash", "-c", `${opts.command}; exec bash`], {
            detached: true,
            stdio: "ignore",
          }).unref();
        } else {
          spawn(candidate, ["-e", "bash", "-c", `cd '${opts.cwd}' && ${opts.command}; exec bash`], {
            detached: true,
            stdio: "ignore",
          }).unref();
        }
        return { ok: true };
      } catch {
        continue;
      }
    }
    return { ok: false, error: "No terminal emulator found. Set $TERMINAL or install gnome-terminal." };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function shellEscape(s: string): string {
  return s.replace(/(["\\$`])/g, "\\$1");
}
```

- [ ] **Step 2: Build the API route.**

`dashboard/app/api/runs/[id]/open-terminal/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getRun } from "@/lib/runs";
import { getRuntime } from "@/lib/runtime/registry";
import { openExternalTerminal } from "@/lib/terminal/openExternal";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";

openDb();

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureServerBooted();
  const { id } = await params;
  const n = parseInt(id, 10);
  const run = getRun(n);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
  if (!run.ptySessionId) return NextResponse.json({ error: "session_id not yet captured" }, { status: 409 });

  const runtime = getRuntime(run.runtimeId);
  if (!runtime) return NextResponse.json({ error: "runtime not registered" }, { status: 500 });

  const command = runtime.formatResumeCommand(run.ptySessionId);
  const result = openExternalTerminal({ cwd: run.worktreePath, command });

  return result.ok
    ? new Response(null, { status: 204 })
    : NextResponse.json({ error: result.error }, { status: 500 });
}
```

- [ ] **Step 3: Smoke test.**

Start a fresh run. Wait for the session_id to appear. Click "Open in terminal" in the RunHeader.

Expected: a terminal window opens, runs `claude --resume <sid>` in the worktree. You see the same session you saw in xterm. Type into the external terminal; the agent responds.

If the terminal doesn't open or runs the wrong command, the platform detection or shell escaping is off. Edit `lib/terminal/openExternal.ts` for your specific terminal until it works.

- [ ] **Step 4: Commit.**

```bash
git add dashboard/lib/terminal/ dashboard/app/api/runs/[id]/open-terminal/
git commit -m "feat(terminal): Open in terminal escape hatch via wt/iTerm/gnome-terminal"
```

---

## Task 14: Worktree management UI

**Files:**
- Create: `dashboard/app/api/projects/[slug]/worktrees/route.ts`, `dashboard/components/project/WorktreeList.tsx`
- Modify: `dashboard/app/projects/[slug]/page.tsx` (add the worktree list under the kanban)

- [ ] **Step 1: Build the worktree API route.**

`dashboard/app/api/projects/[slug]/worktrees/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getProject } from "@/lib/projects";
import { listWorktrees, removeWorktree } from "@/lib/worktrees";
import { listActiveRunsForProject } from "@/lib/runs";
import { openDb } from "@/lib/db";

openDb();

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const all = listWorktrees(project.path);
  const activeRuns = listActiveRunsForProject(slug);
  const activeWorktreePaths = new Set(activeRuns.map(r => r.worktreePath));

  return NextResponse.json({
    worktrees: all
      .filter(w => !w.isPrimary)
      .map(w => ({
        path: w.path,
        branch: w.branch,
        head: w.head,
        isActive: activeWorktreePaths.has(w.path),
      })),
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const url = new URL(req.url);
  const worktreePath = url.searchParams.get("path");
  if (!worktreePath) return NextResponse.json({ error: "path query param required" }, { status: 400 });

  const activeRuns = listActiveRunsForProject(slug);
  if (activeRuns.some(r => r.worktreePath === worktreePath)) {
    return NextResponse.json({ error: "worktree has an active run; stop it first" }, { status: 409 });
  }

  try {
    removeWorktree({ sourceRepoPath: project.path, worktreePath, force: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build `WorktreeList.tsx`.**

```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/common/Button";

interface WorktreeInfo {
  path: string;
  branch: string | null;
  head: string;
  isActive: boolean;
}

interface Props {
  projectSlug: string;
}

export function WorktreeList({ projectSlug }: Props) {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[] | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectSlug}/worktrees`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setWorktrees(data.worktrees);
  }, [projectSlug]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  async function remove(path: string) {
    if (!confirm(`Remove worktree at ${path}? This deletes any uncommitted work in it.`)) return;
    const res = await fetch(`/api/projects/${projectSlug}/worktrees?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Failed: ${data.error ?? res.status}`);
      return;
    }
    reload();
  }

  if (!worktrees) return null;
  if (worktrees.length === 0) {
    return (
      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Worktrees</h3>
        <p className="text-sm text-gray-400">No worktrees.</p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Worktrees</h3>
      <ul className="space-y-2">
        {worktrees.map(w => (
          <li
            key={w.path}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 p-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs truncate" title={w.path}>{w.path}</div>
              <div className="text-xs text-gray-500 mt-1">
                {w.branch ?? "(detached)"} {w.isActive && <span className="text-green-600 ml-2">active</span>}
              </div>
            </div>
            <Button variant="ghost" onClick={() => remove(w.path)} disabled={w.isActive} title={w.isActive ? "Stop the run first" : ""}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Add the list to the project page.**

In `dashboard/app/projects/[slug]/page.tsx`, import `WorktreeList`:
```tsx
import { WorktreeList } from "@/components/project/WorktreeList";
```

Add it under the kanban grid:
```tsx
      <div className="grid grid-cols-[1fr_280px] gap-6">
        <KanbanBoard projectSlug={slug} onOpenIssue={setOpenIssueId} />
        <CrewSidebar crew={crewDisplay} onEditCrew={() => setShowCrewPicker(true)} />
      </div>

      <WorktreeList projectSlug={slug} />
```

- [ ] **Step 4: Smoke test.**

Start a run, then look at the project page. The worktree list should show one entry with "active" status and a disabled Remove button. Stop the run. Remove now works.

- [ ] **Step 5: Commit.**

```bash
git add dashboard/app/api/projects/[slug]/worktrees/ dashboard/components/project/WorktreeList.tsx dashboard/app/projects/
git commit -m "feat(dashboard): worktree management list with remove button"
```

---

## Task 15: Phase 3 verification and QML dogfood

**Files:** none modified.

- [ ] **Step 1: Run all tests.**

```bash
cd dashboard
npm test
```

Expected: every test from Phases 1, 2, 3 passes. Phase 3 added: `worktrees`, `runs`, `registry`, `concurrencyCap`, `sessionIdCapture`, `hookInstaller`.

- [ ] **Step 2: Walk the Phase 3 definition of done.**

Boot the dashboard:
```bash
npm run dev
```

Walk each criterion from the Verification strategy section at the top of this doc (1 through 9). The QML criterion is the headline: file your real research issue, click Start, watch it work.

- [ ] **Step 3: The QML dogfood, properly this time.**

Take the issue you filed in Phase 2:
- Title: "Draft related-work section for QML diagnostics paper, focused on 2024-2026 papers."
- Assignee: lit-reviewer (or whichever agent in your crew has the right skills)
- Status: Queued

Open the issue. Confirm Start is enabled. Click Start.

What you should see, in order:
1. Worktree created at `<workspaceRoot>/qml-healthcare-diagnostics/.worktrees/issue-<id>/`.
2. Status pill flips to "running".
3. xterm in Runs tab shows `claude` initializing.
4. Within ~1.5s, the issue body is typed into the prompt: "Draft related-work section for QML diagnostics paper, focused on 2024-2026 papers."
5. The lit-reviewer agent starts producing output.
6. Session ID appears in RunHeader within ~5s.
7. You can either watch in the dashboard or click "Open in terminal" to take over in your native terminal.

Let it run. When the agent finishes (or you stop it), check the worktree:
```bash
git -C <workspaceRoot>/qml-healthcare-diagnostics/.worktrees/issue-<id> diff
git -C <workspaceRoot>/qml-healthcare-diagnostics/.worktrees/issue-<id> log --oneline -10
```

You should see whatever files the agent created or modified.

If you're happy with the output, you can merge `agentic-os/issue-<id>` into main, or cherry-pick commits, or just copy files out of the worktree. The dashboard is hands-off after the run ends; integration is your call.

- [ ] **Step 4: Tag the phase.**

```bash
cd ..
git tag -a path-a-phase-3 -m "Path A reset Phase 3: agents run end-to-end via PTY + xterm + worktree"
```

Phase 3 is done. Phase 4 (Agents page UX) and beyond are all incremental polish; Phase 3 is the foundation that turns the rebuild from "kanban with no engine" into "actually working agentic OS."

---

## Self-review

Spec coverage against Spec 0002 acceptance criteria:

- A1 through A5: covered by Phases 1 and 2.
- A6 (click Start spawns a run, agent works in its worktree): Tasks 7, 9, 10.
- A7 (parallel issues with worktrees, concurrency caps): Tasks 2, 5, 12.
- A8 (hooks): partially covered, just SessionStart for session_id capture. Full hooks system is Phase 5.
- A9 (open in terminal with `claude --resume`): Tasks 4 (formatResumeCommand), 13 (the escape hatch).
- A10 (settings page UI): not in Phase 3; the data layer for settings exists from Phase 1 and the read endpoint ships in Task 12.
- A11 (migration idempotent): no new migrations in Phase 3.
- A12 (no resurrected lib modules): naturally satisfied.
- A13 (QML dogfood): Task 15 Step 3.

Placeholder scan: every code step has complete code. No "TBD", no "implement later", no "patch this later inline" notes.

Type-consistency check across tasks:

- `SpawnedRun` interface defined in Task 3 (types.ts) declares `pty`, `onSessionId`, `notifySessionId`, `cleanup`. Used by `claude-code.ts` in Task 4 (returns this shape), `liveRuns.ts` in Task 6 (subscribes to `onSessionId` in registerLiveRun, calls `notifySessionId` in notifyExternalSessionId), and `server.ts` in Task 6 (uses `pty.onData`, `pty.onExit`, `pty.write`, `pty.resize`).
- `attachSessionId` is exported from `lib/runs.ts` (Task 5) and called only by `liveRuns.ts` (Task 6). The hook API route (Task 7) does NOT call it; the bridge in `registerLiveRun` calls it via the `onSessionId` listener. Single write path.
- `Run` shape (id, issueId, agentSlug, runtimeId, worktreePath, ptySessionId, startedAt, endedAt, exitStatus, transcriptPath) appears in `lib/runs.ts` (Task 5), the runs API (Task 7), and `useRun.ts` (Task 9). Field names consistent throughout.
- `IssueStatus` ("backlog" | "queued" | "running" | "review" | "done" | "failed") is set by both `updateIssue` calls in `server.ts` onExit (Task 6) and `api/runs/[id] DELETE` (Task 7) for the failure path, and by `api/runs POST` (Task 7) for the running transition. Status transitions form a closed system.

Architectural risks and how Phase 3 addresses them:

1. **node-pty install reliability across platforms.** Task 0 Step 5 and Task 1 verify before any other code runs.
2. **Claude Code CLI behavior drift.** Task 0 verifies `--version`, `--resume`, and SessionStart hook firing. If the CLI changes incompatibly between when this plan was written and when it gets executed, Task 0 catches it.
3. **Session ID capture is unreliable in interactive mode.** Mitigated by the hook + jsonl race in Task 4, with a single convergence point at `fireSessionId`. The hook path routes through `spawned.notifySessionId` to share the same resolution logic, so persistence (via the bridge in `registerLiveRun`) and external waiters (via sidWaiters) are guaranteed for both paths. If both fail, the run still works; only the "Open in terminal" escape hatch breaks.
4. **WebSocket disconnection mid-run.** The server keeps the PTY alive on WebSocket close (server.ts comment notes this). The operator reconnects by reopening the issue drawer. Backfilling scrollback is not implemented; the operator sees only output from reconnect onwards. Acceptable for Phase 3; revisit if it becomes a real pain.
5. **Worktree cleanup races.** The remove endpoint refuses if a run is active. The runtime tracks live runs in a Map keyed by run_id; if the server crashes mid-run, the Map is lost but the runs table still has unended rows. On next boot, those rows have `ended_at IS NULL` but no live process. The concurrency cap will count them as active. Fix in Phase 4 by adding a "stale run reaper" that runs on boot and marks orphaned rows as failed.
6. **Multi-layer integration failure on first run.** Task 10 Step 1 instruments every layer boundary BEFORE the first end-to-end attempt, per `superpowers:systematic-debugging`. The Step 6 diagnosis tree maps every "last log line seen" to a likely cause and first-action fix. Boundary logs stay permanently in the codebase.

Known gaps to fix in Phase 4 or later:

1. **Orphaned runs after server restart.** See risk #5 above. Phase 4 stale-run reaper on boot.
2. **Scrollback after WebSocket reconnect.** Not implemented. The PTY's recent output is lost unless the client was connected. Buffering the last N bytes per run in `liveRuns.ts` would close this.
3. **Settings UI to edit concurrency caps.** Caps are hardcoded to defaults in `lib/settings.ts`. The GET endpoint exists (Task 12); the PUT and the UI ship in Phase 6.
4. **Hook script lifecycle.** The SessionStart hook is installed per-worktree but never cleaned up if the worktree is removed by hand outside the dashboard. Harmless; the hook script just becomes a stale entry in a deleted `.claude/settings.local.json`.
5. **Agent's first message timing.** The 1200ms delay before typing the issue body into the PTY is empirical. If a particular machine is slow or fast, adjust `PROMPT_READY_DELAY_MS` in `lib/runtime/claude-code.ts`. A more robust approach watches for a specific prompt marker in the PTY output before sending; consider for Phase 4 if the delay causes flakiness.
6. **No way to send a follow-up message from the dashboard mid-run.** The thread composer in the Issue drawer adds comments to the thread file, but they don't reach the running agent. To talk to the agent, type into xterm directly. A "send to agent" button that writes through the PTY would close this gap; consider for Phase 4.
7. **`process.env.AGENTIC_OS_PUBLIC_URL`** is read in `lib/runtime/claude-code.ts` to build the hook callback URL. Defaults to `http://localhost:3000`. If the dashboard runs on a different port, set this env var.

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-05-20-path-a-reset-phase-3.md`.

Recommended execution mode for Phase 3: **inline, with manual checkpoints**, not subagent-driven. Reasons:

1. Task 0 is irreducibly manual; it verifies your specific machine's CLI behavior.
2. Tasks 1, 4, 10, 13 all involve external process behavior (PTYs, the `claude` CLI, terminal emulators) that can fail in ways no test catches. You want to be in the loop when they run.
3. Tasks 6 through 9 are tightly coupled and the integration moment is Task 10. A subagent that finishes Task 6 in isolation can't confirm it actually works without doing Tasks 7, 8, 9. Better to keep one operator following the thread.

Suggested checkpoint pattern: review after Task 1 (does PTY work on this machine), Task 4 (does claude-code runtime spawn correctly with a manual test), Task 10 (THE moment, end-to-end), Task 13 (terminal escape hatch works). Tasks 2, 3, 5, 11, 12, 14 are mechanical and can be batched.

When Phase 3 closes, Phase 4 polishes the Agents page (the spec's least-detailed section), Phase 5 ships the full hooks system, Phase 6 ships the Settings UI and cost visibility, Phase 7 adds a second runtime (codex or gemini-cli, whichever is most useful). None of those are blockers for productive use; Phase 3 makes the system real.
