# Fixes — getting runs to actually work

Branch: `Fixes`. Goal of this pass: **boot + one agent run end-to-end** (pressing
Start on an assigned issue actually spawns an agent that receives its task), and
prove it with tests you can run on your Windows PC.

## The honest diagnosis

The project is **not** under-built — ~98% of the documented vision (specs
0007–0034) is implemented and the architecture is sound. What was broken was a
small set of **operational bugs in the run-spawn path**:

1. **"Stuck on Starting…" = a server hang.** `lib/worktrees.ts` ran
   `spawnSync("git", …)` with **no timeout**. `spawnSync` blocks the entire
   single-threaded server; if `git worktree add` stalls on Windows (credential
   prompt, index lock, Defender/OneDrive-synced workspace) the `POST /api/runs`
   request — and the whole server — freeze forever, so the Start button spins.
2. **Windows `.cmd` launch.** Detection used `shell:true` (so a runtime *showed*
   as available), but the real launch was `pty.spawn("claude.cmd", …)` with no
   shell. Windows `CreateProcess` (what node-pty calls) can't exec a `.cmd`
   directly — it must go through `cmd.exe /c`.
3. **"Agent does nothing" = timing-based prompt typing.** The task was typed into
   the CLI after fixed magic delays (1.5s/5s). On a cold/slow machine the TUI
   wasn't ready, so the prompt was dropped and the agent sat idle. (Antigravity
   already did this right via `--prompt-interactive`.)
4. **"Automations never fire"** — by design, not a bug: the scheduler needs a
   `project:` key on the spec **and** the `autonomy` + `scheduler` toggles on
   (off by default). None of the shipped specs have a `project:` key.
5. **"Choppy UI"** — runtime detection used synchronous `spawnSync`, stalling the
   event loop.

## What changed

- **`lib/worktrees.ts`** — `runGit` now passes a `timeout` (default 30s,
  `AGENTIC_OS_GIT_TIMEOUT_MS`) + `windowsHide`, and maps a timeout/ENOENT to a
  clear `WorktreeError` instead of hanging. Git bin overridable via
  `AGENTIC_OS_GIT_BIN`.
- **`lib/runtime/launch.ts`** (new) — `resolveLaunch()` wraps Windows `.cmd`/
  `.bat` shims in `cmd.exe /c`; real `.exe`s and all posix bins pass through.
  Pure/unit-tested. Only static flags go through it; prompts never do (cmd.exe
  would mangle them).
- **`lib/runtime/promptInjector.ts`** (new) — `injectPrompt()` waits for the TUI
  to render and go quiet ("settle") before typing the task into the PTY, with a
  hard backstop. Deterministic and testable; binary-safe for any prompt text.
- **`lib/runtime/detect.ts`** (new) — `probeVersion()` detects CLIs with async
  `execFile` (no event-loop blocking) via `resolveLaunch`.
- **`claude-code.ts` / `gemini-cli.ts` / `antigravity-cli.ts`** — spawn via
  `resolveLaunch`, deliver the prompt via `injectPrompt` (claude/gemini) or argv
  (agy), detect via `probeVersion`. Bins overridable via `AGENTIC_OS_CLAUDE_BIN`
  / `AGENTIC_OS_GEMINI_BIN` / `AGENTIC_OS_AGY_BIN` (read per call).
- **`components/issue/StartButton.tsx`** — the Start fetch now has a 60s
  `AbortController` timeout, so the button can never spin forever; a hung server
  surfaces as a visible error.
- **`automations/remote/README.md`** — documents the in-dashboard scheduler's
  firing requirements (the `project:` key + the two toggles).

## How to verify

On any machine:

```bash
cd dashboard
npm install
npm test            # 421 tests incl. the new run-pipeline coverage
npm run build
```

The new tests (in `dashboard/tests/`):

- `launch-resolve.test.ts` — Windows `.cmd` → `cmd.exe /c`; `.exe`/posix pass-through.
- `promptInjector.test.ts` — settle-based delivery, backstop, dispose, fire-once.
- `worktree-timeout.test.ts` — a stalled git times out fast instead of hanging.
- `run-pipeline.e2e.test.ts` — spawns a **stub CLI** through the real claude/
  gemini/agy runtimes and asserts it launches in the worktree, **receives the
  prompt**, and exits. On Windows the stub is a `.cmd`, so this exercises the
  exact `cmd.exe`-wrapping path that was failing.
- `startRun-errors.test.ts` — the pipeline fails fast with typed HTTP errors
  (never hangs).

> Note: this environment enforces git commit signing, which breaks temp-repo test
> setup. If `worktrees`/`learningTopics`/`run-pipeline` tests fail with a signing
> error, run `git config --global commit.gpgsign false` first. On your machine
> this isn't needed.

Then the real thing: start the dashboard (`npm run dev`), assign an agent + CLI
to an issue, press **Start**. It should leave "Starting", stream the agent, and
the agent should act on the task. If anything's still off on Windows, grab the
dashboard console output around the Start click and share it — the new errors are
explicit (timeouts, spawn failures) instead of a silent hang.
