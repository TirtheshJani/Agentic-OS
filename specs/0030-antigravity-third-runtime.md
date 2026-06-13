# Spec 0030: Antigravity CLI as the Third Runtime

> **Status:** Shipped (commit f3110fa). Supersedes ADR-008's "Codex as
> candidate third runtime." The capability architecture from spec 0006 carries
> over unchanged; only a third concrete runtime is added. See ADR-023.

## Why Antigravity

ADR-008 chose Gemini over Codex for the second runtime on entitlement grounds
and left Codex as a notional third. Google Antigravity then shipped `agy`, an
interactive coding CLI that runs under a PTY exactly like claude-code and
gemini-cli, satisfying the same runtime-abstraction criteria without a new
subscription the operator does not already hold. Adding it is purely additive:
the `Runtime` contract and capability gating from spec 0006 need no changes.

## Verified CLI facts

- `agy --version` prints a semver; `detect()` parses it.
- `agy` is a real `.exe`/binary (not an npm `.cmd` shim), installed by
  `agy install` to a fixed location: `%LOCALAPPDATA%\agy\bin\agy.exe` on
  Windows, `~/.local/share/agy/bin/agy` elsewhere. That PATH entry only reaches
  processes started after install, so the runtime prefers the absolute install
  path and falls back to the bare name on PATH.
- `--prompt-interactive <prompt>` runs the prompt and stays interactive — the
  initial prompt is a flag value, not typed into the PTY, so the ConPTY
  type-then-delayed-Enter dance is unnecessary.
- `--dangerously-skip-permissions` auto-approves tool actions (the worktree
  bounds the blast radius) and there is no first-run trust dialog to clear.
- `--model <id>` selects a model; `agy models` lists ids but requires auth, so
  models cannot be enumerated at build time.
- `agy --continue` resumes the most recent conversation in the cwd. agy assigns
  its conversation id internally and exposes no way to preset or capture it.

## Implementation

`dashboard/lib/runtime/antigravity-cli.ts` mirrors the other two runtimes:

- `resolveAgyBin()`: documented absolute install path if present, else `agy` /
  `agy.exe` on PATH. Resolving an absolute path lets node-pty launch it directly
  with no shell.
- `detect()`: `spawnSync(AGY_BIN, ["--version"])` (no `shell: true` — a real
  executable, so paths with spaces stay intact); parses semver; returns an
  install hint in `error` when missing.
- `agySpawnArgs(prompt, model)` (exported, pure, unit-testable):
  `["--prompt-interactive", prompt, "--dangerously-skip-permissions",
  ...(model ? ["--model", model] : [])]`.
- `spawn()`: `pty.spawn(AGY_BIN, agySpawnArgs(...), { cwd: worktreePath })`. A
  self-assigned `randomUUID()` is the run row's `ptySessionId` (the
  open-in-terminal route needs one); `onSessionId` fires synchronously on
  subscribe. Resume does not use this id — `agy --continue` is cwd-scoped and
  each run owns its worktree, so `--continue` from that worktree lands on
  exactly this run's conversation.
- Capabilities: `{ sessionResume: true, sessionIdCapture: false, hooks: false,
  transcriptCostParsing: false, externalTerminalEscape: true }`.
- `models: []` — the editor offers "Default" plus a free-text Custom field
  (the frontmatter `model` is an open string), so any id from `agy models`
  works once authenticated.
- `formatResumeCommand: () => "agy --continue"` (sid unused; the open-terminal
  route runs it from the run's worktree).

Carried over from spec 0006/0007 unchanged: the `RuntimeCapabilities` contract,
`GET /api/runtimes`, the `RuntimeBadge`, per-run/per-agent/per-project runtime
resolution, and capability-driven UI gating (open-in-terminal hidden unless
`externalTerminalEscape`; hook/cost surfaces degrade when the flags are false).

Registration: `registerRuntime(antigravityCliRuntime)` in
`dashboard/lib/server-init.ts`, after claude-code and gemini-cli.

## Out of scope

Cross-runtime tool translation, mid-session runtime migration, cost
normalization, and enumerating agy models at build time (the Custom field
covers them). The Events tab and synthetic lifecycle events remain as described
by spec 0006 — `agy` declares `hooks: false`, so those surfaces gate off for it
exactly as they do for gemini.

## Operator setup

1. Install: `irm https://antigravity.google/cli/install.ps1 | iex`, then
   `agy install` (the install hint in `detect()` repeats this).
2. Run `agy` once interactively and complete auth; the dashboard assumes a
   logged-in CLI (same policy as claude and gemini).
3. The `/runtimes` view shows availability and this setup hint when `agy` is
   missing. A dashboard already running when `agy` was installed is found via
   the absolute install path without a restart.

## Acceptance

- `GET /api/runtimes` lists claude-code, gemini-cli, and antigravity-cli with
  capabilities and availability.
- An issue started with the antigravity-cli override spawns `agy` in the
  worktree, streams to xterm, keystrokes round-trip, and exit transitions the
  issue.
- The self-assigned session id appears in RunHeader immediately.
- Open-in-terminal is available for agy runs (`externalTerminalEscape: true`)
  and runs `agy --continue` from the worktree.
- Mixed-runtime crews work; runs attribute to their runtime.
