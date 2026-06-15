import * as pty from "node-pty";
import { randomUUID } from "node:crypto";
import type { Runtime, SpawnOpts, SpawnedRun, RuntimeAvailability } from "@/lib/runtime/types";
import { resolveLaunch } from "@/lib/runtime/launch";
import { probeVersion } from "@/lib/runtime/detect";
import { injectPrompt } from "@/lib/runtime/promptInjector";

// Same .cmd shim situation as claude-code.ts: npm-installed CLIs on Windows are
// .cmd files; the PTY launch is routed through cmd.exe by resolveLaunch.
// Resolved per call so an env override applies post-boot and tests can point it
// at a stub.
function geminiBin(): string {
  return process.env.AGENTIC_OS_GEMINI_BIN || (process.platform === "win32" ? "gemini.cmd" : "gemini");
}

function detectGemini(): Promise<RuntimeAvailability> {
  return probeVersion(geminiBin(), "gemini not on PATH (npm i -g @google/gemini-cli)");
}

/** Exported for tests: argv construction is pure, the PTY spawn is not. */
export function geminiSpawnArgs(sessionId: string, model?: string): string[] {
  return ["--yolo", "--skip-trust", "--session-id", sessionId, ...(model ? ["-m", model] : [])];
}

async function spawnGemini(opts: SpawnOpts): Promise<SpawnedRun> {
  console.log(`[gemini-cli.spawn] run ${opts.runId}: cwd=${opts.worktreePath}, prompt length=${opts.initialPrompt.length}`);

  // Gemini CLI has no SessionStart-hook equivalent, but it accepts a
  // caller-provided session UUID (--session-id, verified in v0.46.0), so we
  // generate one up front and the session id is known before the PTY even
  // starts. No watcher, no hook installer.
  const sessionId = randomUUID();

  // --yolo auto-approves tool actions (counterpart of claude's
  // --dangerously-skip-permissions; the worktree bounds the blast radius).
  // --skip-trust suppresses the workspace trust dialog for this session, so
  // unlike claude-code no blind Enter is needed.
  const launch = resolveLaunch({ bin: geminiBin(), args: geminiSpawnArgs(sessionId, opts.model) });
  const term = pty.spawn(launch.file, launch.args, {
    name: "xterm-color",
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
    cwd: opts.worktreePath,
    env: { ...process.env } as Record<string, string>,
  });

  // Deliver the prompt once the TUI has rendered and gone quiet (settle-based;
  // see promptInjector). No blind Enter: --skip-trust suppresses the trust
  // dialog, so there is nothing to dismiss before the input prompt.
  const disposeInject = injectPrompt(term, opts.initialPrompt, {
    log: (m) => console.log(`[gemini-cli] run ${opts.runId}: ${m}`),
  });

  return {
    pty: term,
    onSessionId(cb) {
      // Resolved synchronously at spawn: fire immediately, always.
      try { cb(sessionId); } catch (err) { console.error("[gemini-cli] sid listener threw:", err); }
    },
    notifySessionId() {
      // No external capture path exists for gemini; the self-assigned id wins.
    },
    async cleanup() {
      disposeInject();
      try { term.kill(); } catch { /* already dead */ }
    },
  };
}

export const geminiCliRuntime: Runtime = {
  id: "gemini-cli",
  displayName: "Gemini CLI",
  models: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
  capabilities: {
    // Verified against gemini-cli v0.46.0:
    // - resume is cwd-scoped via `--resume latest` (sessions are stored per
    //   project derived from cwd); `--resume` takes "latest" or an index, NOT
    //   a UUID, so the captured --session-id is not a resume key. Each worktree
    //   holds one session, so cwd-scoped latest re-attaches that run.
    // - no SessionStart-style lifecycle hooks exist (gemini --help has none);
    //   startRun synthesizes SessionStart for hookless runtimes.
    sessionResume: true,
    sessionIdCapture: true,
    hooks: false,
    transcriptCostParsing: false,
    externalTerminalEscape: true,
  },
  detect: detectGemini,
  spawn: spawnGemini,
  // cwd-scoped resume: the external terminal opens in the run's worktree, where
  // "latest" is this run's session. The session-id marker is ignored (gemini
  // --resume does not accept a UUID), mirroring antigravity's --continue.
  // Carry the same --yolo --skip-trust as spawn so a resumed session keeps
  // skipping the trust dialog and per-action approvals instead of re-prompting.
  formatResumeCommand: () => `gemini --resume latest --yolo --skip-trust`,
};
