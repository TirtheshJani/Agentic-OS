import * as pty from "node-pty";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Runtime, SpawnOpts, SpawnedRun, RuntimeAvailability } from "@/lib/runtime/types";
import { resolveLaunch } from "@/lib/runtime/launch";
import { probeVersion } from "@/lib/runtime/detect";

// Google Antigravity ships a real .exe (not an npm .cmd shim). `agy install`
// adds its bin dir to PATH, but that only reaches processes started afterward;
// a dashboard already running when agy was installed won't see it. So prefer
// the binary at its documented install location (%LOCALAPPDATA%\agy\bin on
// Windows, ~/.local/share/agy/bin elsewhere) and fall back to the bare name on
// PATH. Resolving an absolute path also lets node-pty launch it directly.
// Overridable via env for tests / non-standard installs.
function resolveAgyBin(): string {
  if (process.env.AGENTIC_OS_AGY_BIN) return process.env.AGENTIC_OS_AGY_BIN;
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const installed = path.join(localAppData, "agy", "bin", "agy.exe");
      if (fs.existsSync(installed)) return installed;
    }
    return "agy.exe";
  }
  const home = process.env.HOME;
  if (home) {
    const installed = path.join(home, ".local", "share", "agy", "bin", "agy");
    if (fs.existsSync(installed)) return installed;
  }
  return "agy";
}

function detectAgy(): Promise<RuntimeAvailability> {
  // agy is a real .exe (resolved to an absolute path when installed), so
  // resolveLaunch passes it through directly — no cmd.exe wrapper. Resolved per
  // call so an env override applies post-boot and tests can point it at a stub.
  return probeVersion(
    resolveAgyBin(),
    "agy not on PATH (install: irm https://antigravity.google/cli/install.ps1 | iex, then `agy install`)"
  );
}

/**
 * Exported for tests: argv construction is pure, the PTY spawn is not.
 *
 * Unlike claude/gemini (which boot a bare TUI and then have the prompt typed
 * into the PTY), agy accepts the initial prompt directly as a flag value with
 * --prompt-interactive: it runs the prompt and stays interactive. That removes
 * the ConPTY type-then-delayed-Enter dance entirely. --dangerously-skip-permissions
 * auto-approves tool actions (the worktree bounds the blast radius), which also
 * means there is no first-run trust dialog to blind-Enter past.
 */
export function agySpawnArgs(prompt: string, model?: string): string[] {
  return [
    "--prompt-interactive", prompt,
    "--dangerously-skip-permissions",
    ...(model ? ["--model", model] : []),
  ];
}

async function spawnAgy(opts: SpawnOpts): Promise<SpawnedRun> {
  console.log(`[antigravity-cli.spawn] run ${opts.runId}: cwd=${opts.worktreePath}, prompt length=${opts.initialPrompt.length}`);

  // agy assigns its own conversation id internally and exposes no way to preset
  // or capture it (no SessionStart hook, no caller-provided id). We self-assign
  // a UUID purely so the run row gets a stable ptySessionId — the "Open in
  // terminal" route requires one. Resume does not use this id: agy --continue is
  // cwd-scoped, and each run owns its worktree, so --continue from that worktree
  // lands on exactly this run's conversation. sessionIdCapture is therefore
  // declared false: the id is a local marker, not a real captured agy id.
  const sessionId = randomUUID();

  // agy is a real .exe, so resolveLaunch passes it through unchanged (no cmd.exe
  // wrapper); the arbitrary prompt therefore travels as a clean argv element,
  // not through a shell command line. Routed through resolveLaunch for parity
  // with the other runtimes and to honor an env-overridden stub bin in tests.
  const launch = resolveLaunch({ bin: resolveAgyBin(), args: agySpawnArgs(opts.initialPrompt, opts.model) });
  const term = pty.spawn(launch.file, launch.args, {
    name: "xterm-color",
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
    cwd: opts.worktreePath,
    env: { ...process.env } as Record<string, string>,
  });

  return {
    pty: term,
    onSessionId(cb) {
      // Resolved synchronously at spawn: fire immediately, always.
      try { cb(sessionId); } catch (err) { console.error("[antigravity-cli] sid listener threw:", err); }
    },
    notifySessionId() {
      // No external capture path exists for agy; the self-assigned id wins.
    },
    async cleanup() {
      try { term.kill(); } catch { /* already dead */ }
    },
  };
}

export const antigravityCliRuntime: Runtime = {
  id: "antigravity-cli",
  displayName: "Antigravity CLI",
  // agy lists its models via `agy models`, which requires auth and so cannot be
  // enumerated at build time. Left empty: the editor offers "Default" plus a
  // free-text Custom field (the frontmatter model is an open string), so any id
  // from `agy models` works once authenticated.
  models: [],
  capabilities: {
    // agy --continue resumes the most recent conversation in the cwd; each run
    // owns its worktree, so resume is reliable per run.
    sessionResume: true,
    // No preset/captured conversation id; we self-assign a marker UUID.
    sessionIdCapture: false,
    hooks: false,
    transcriptCostParsing: false,
    externalTerminalEscape: true,
  },
  detect: detectAgy,
  spawn: spawnAgy,
  // sid is unused: --continue is cwd-scoped and the open-terminal route runs it
  // from the run's worktree, landing on this run's conversation.
  formatResumeCommand: () => `agy --continue`,
};
