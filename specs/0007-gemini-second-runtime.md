# Spec 0007: Gemini CLI as the Second Runtime

> **Status:** Shipped with the command-center build (June 2026). Supersedes
> spec 0006's D9 (Codex). The capability architecture from spec 0006 carries
> over unchanged; only the concrete second runtime differs. See ADR-008.

## Why Gemini instead of Codex

Spec 0006 picked Codex for paradigm similarity and real-world usage. The
operator decision that supersedes it is entitlement-driven: TJ already pays
for Claude Max (drives claude-code through the logged-in CLI) and Google AI
Pro (raises Gemini CLI limits through personal Google OAuth). Codex would
need a third subscription. Gemini CLI also satisfies the original D9
criteria: it is an interactive TUI that runs inside a PTY exactly like
claude-code, it is vendor-maintained with frequent releases, and it
stress-tests the runtime abstraction on a non-Anthropic CLI.

## Verified CLI facts (v0.46.0, 2026-06-10, local)

- `gemini --version` prints a semver (`0.46.0`).
- `-p/--prompt` runs headless; `--output-format text|json|stream-json`.
- `--yolo` auto-approves all actions (also `--approval-mode yolo`).
- `--skip-trust` trusts the workspace for the session (no trust dialog).
- `--session-id <uuid>` starts a session with a caller-provided UUID.
- `--resume <"latest"|index>` resumes; resume-by-UUID is NOT documented, so
  `sessionResume` stays `false` until verified.
- No Claude Code-style lifecycle hooks; `gemini hooks` manages its own hook
  system but there is no SessionStart HTTP callback equivalent.
- MCP servers configured via `gemini mcp` / `~/.gemini/settings.json`.

## Implementation

`dashboard/lib/runtime/gemini-cli.ts` mirrors `claude-code.ts`:

- `GEMINI_BIN`: `gemini.cmd` on win32 (npm shim), `gemini` elsewhere.
- `detect()`: `spawnSync(GEMINI_BIN, ["--version"])` with `shell: true` on
  win32; parses semver; returns an install hint in `error` when missing.
- `spawn()`: `pty.spawn(GEMINI_BIN, ["--yolo", "--skip-trust",
  "--session-id", randomUUID()], { cwd: worktreePath })`. No hook installer,
  no jsonl watcher. The self-generated UUID resolves the session id
  synchronously; `onSessionId` fires immediately on subscribe.
- Prompt delivery: whitespace-collapsed body written at T+4s, then a
  separate `"\r"` write 250ms later (same ConPTY quirk fix as claude-code,
  commit 63a4ecd).
- Capabilities: `{ sessionResume: false, sessionIdCapture: true, hooks:
  false, transcriptCostParsing: false, externalTerminalEscape: false }`.

Carried over from spec 0006 unchanged:

- `RuntimeCapabilities` on the `Runtime` interface (`lib/runtime/types.ts`).
- claude-code declares its own capabilities (`transcriptCostParsing: false`
  until a cost parser actually exists; spec 0006 anticipated one that was
  never built).
- `GET /api/runtimes` returns id, displayName, capabilities, availability
  (detect results cached 60s per module instance).
- `RuntimeBadge` on RunHeader; unknown runtime ids render the raw id in
  gray with all capability gates off (spec 0006 F13).
- Per-run runtime override: `POST /api/runs` accepts optional `runtimeId`;
  resolution is `override ?? agent.runtime ?? project.runtime-default`.
  RunsTab shows the override select only when more than one runtime is
  registered and no run is active.

## Out of scope (unchanged from 0006)

Cross-runtime tool translation, mid-session runtime migration, third+
runtimes, cost normalization. Additionally out of scope here: the Events
tab, cost chip, and synthetic lifecycle events described by spec 0006
(those UI surfaces do not exist in the current dashboard; if they land
later, the capability flags are already in place to gate them).

## Operator setup

1. `npm i -g @google/gemini-cli`
2. Run `gemini` once interactively and complete Google OAuth with the
   AI Pro account. First-run theme/auth dialogs must be cleared manually
   once; the dashboard assumes a logged-in CLI (same policy as claude).
3. The runtimes view shows availability and this setup hint when gemini is
   missing.

## Acceptance

- `GET /api/runtimes` lists claude-code and gemini-cli with capabilities
  and availability (spec 0006 F1).
- An issue started with the gemini-cli override spawns the Gemini TUI in
  the worktree, streams to xterm, keystrokes round-trip, exit transitions
  the issue (F5).
- Session id appears in RunHeader immediately (self-assigned UUID) (F6).
- Open-in-terminal is hidden for gemini runs (F8 with
  `externalTerminalEscape: false`).
- Mixed-runtime crews work; runs attribute to their runtime (F10).
