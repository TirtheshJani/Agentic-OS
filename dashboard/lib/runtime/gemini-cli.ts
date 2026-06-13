import * as pty from "node-pty";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Runtime, SpawnOpts, SpawnedRun, RuntimeAvailability } from "@/lib/runtime/types";

// Same .cmd shim situation as claude-code.ts: npm-installed CLIs on Windows
// are .cmd files, and node-pty's CreateProcess needs the explicit name.
const GEMINI_BIN = process.platform === "win32" ? "gemini.cmd" : "gemini";

function detectGemini(): RuntimeAvailability {
  const r = spawnSync(GEMINI_BIN, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) {
    return { available: false, version: null, error: r.stderr || "gemini not on PATH (npm i -g @google/gemini-cli)" };
  }
  const m = r.stdout.match(/(\d+\.\d+\.\d+)/);
  return { available: true, version: m ? m[1] : r.stdout.trim() };
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
  const term = pty.spawn(GEMINI_BIN, geminiSpawnArgs(sessionId, opts.model), {
    name: "xterm-color",
    cols: opts.cols ?? 120,
    rows: opts.rows ?? 30,
    cwd: opts.worktreePath,
    env: { ...process.env } as Record<string, string>,
  });

  // Deliver the prompt after the TUI has booted. Same ConPTY quirk handling
  // as claude-code.ts: collapse whitespace to keep the input single-line, and
  // send Enter as a separate delayed write so the TUI registers a discrete
  // keypress (body + "\r" in one chunk is not reliably parsed).
  const PROMPT_READY_DELAY_MS = 4000;
  setTimeout(() => {
    try {
      const body = opts.initialPrompt.replace(/\s+/g, " ").trim();
      if (body.length > 0) {
        console.log(`[gemini-cli] run ${opts.runId}: writing initial prompt (${body.length} chars) to PTY`);
        term.write(body);
        setTimeout(() => { try { term.write("\r"); } catch { /* PTY dead */ } }, 250);
      }
    } catch (err) {
      console.error(`[gemini-cli] run ${opts.runId}: PTY write failed:`, err);
    }
  }, PROMPT_READY_DELAY_MS);

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
  detect: async () => detectGemini(),
  spawn: spawnGemini,
  // cwd-scoped resume: the external terminal opens in the run's worktree, where
  // "latest" is this run's session. The session-id marker is ignored (gemini
  // --resume does not accept a UUID), mirroring antigravity's --continue.
  formatResumeCommand: () => `gemini --resume latest`,
};
