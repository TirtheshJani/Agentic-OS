import * as pty from "node-pty";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Runtime, SpawnOpts, SpawnedRun, RuntimeAvailability } from "@/lib/runtime/types";
import { installSessionStartHook } from "@/lib/runtime/hookInstaller";
import { watchForJsonlSessionId } from "@/lib/runtime/sessionIdCapture";
import { REPO_ROOT } from "@/lib/paths";

const HOOK_SCRIPT_PATH = path.join(REPO_ROOT, "dashboard", "scripts", "claude-session-hook.js");

// On Windows, npm-installed CLIs are .cmd shims, not .exe. node-pty's
// CreateProcess can launch .cmd files when given the explicit name (or full
// path), but plain "claude" looks for claude.exe and fails with error code 2.
const CLAUDE_BIN = process.platform === "win32" ? "claude.cmd" : "claude";

function detectClaude(): RuntimeAvailability {
  // spawnSync accepts shell:true on Windows so the .cmd shim resolves; pty
  // calls below use the resolved binary name directly.
  const r = spawnSync(CLAUDE_BIN, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
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

/** Exported for tests: argv construction is pure, the PTY spawn is not. */
export function claudeSpawnArgs(model?: string): string[] {
  return ["--dangerously-skip-permissions", ...(model ? ["--model", model] : [])];
}

async function spawnClaude(opts: SpawnOpts): Promise<SpawnedRun> {
  console.log(`[claude-code.spawn] run ${opts.runId}: cwd=${opts.worktreePath}, prompt length=${opts.initialPrompt.length}`);
  // 1. Install SessionStart hook in worktree so claude calls back with session_id.
  installSessionStartHook({
    worktreePath: opts.worktreePath,
    hookScriptPath: HOOK_SCRIPT_PATH,
    callbackUrl: `${getCallbackBaseUrl()}/api/runs/${opts.runId}/hook`,
    runId: opts.runId,
  });

  // 2. Spawn claude in the worktree.
  // --dangerously-skip-permissions bypasses the first-run workspace trust
  // dialog and per-tool permission prompts. The operator is delegating to the
  // agent specifically to take actions in this worktree, so a blocking
  // permission TUI here just deadlocks the run. The worktree is isolated from
  // the canonical repo, so the blast radius is bounded.
  const term = pty.spawn(CLAUDE_BIN, claudeSpawnArgs(opts.model), {
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
    console.log(`[claude-code] run ${opts.runId}: session_id resolved = ${sid}`);
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

  // 4. First-run-per-worktree trust prompt: claude shows a "Quick safety check"
  // dialog with option 1 ("Yes, I trust this folder") pre-selected, and the
  // session does not start until Enter is pressed. We can't reliably parse the
  // PTY stream for the marker (chunked, ANSI-interleaved), so just send Enter
  // blindly after spawn. If the prompt is up, this accepts it. If the regular
  // input prompt is up, this submits an empty line which is a no-op.
  const TRUST_ACCEPT_DELAY_MS = 1500;
  setTimeout(() => {
    try {
      console.log(`[claude-code] run ${opts.runId}: sending blind Enter for possible trust prompt`);
      term.write("\r");
    } catch { /* PTY dead */ }
  }, TRUST_ACCEPT_DELAY_MS);

  // 5. Wait for the input prompt to be ready (post-trust-accept), then send
  // the issue body. Delay covers the trust-prompt acceptance path: 1.5s blind
  // Enter + ~3s for claude to initialize the session = ~4.5s total.
  const PROMPT_READY_DELAY_MS = 5000;
  setTimeout(() => {
    try {
      // Collapse newlines: Claude's TUI treats embedded \n as "newline within
      // input" and stays in multi-line mode, so a single trailing \r doesn't
      // submit. Replace runs of whitespace (including newlines) with a single
      // space to keep the prompt as one logical line.
      const body = opts.initialPrompt.replace(/\s+/g, " ").trim();
      if (body.length > 0) {
        console.log(`[claude-code] run ${opts.runId}: writing initial prompt (${body.length} chars) to PTY`);
        term.write(body);
        // Send Enter as a separate write after the body. When body + "\r" is
        // written in one call, node-pty/ConPTY can deliver it as a single
        // chunk and the TUI does not register the final byte as a discrete
        // Enter keypress. A delayed second write of just "\r" submits.
        setTimeout(() => { try { term.write("\r"); } catch { /* PTY dead */ } }, 250);
      }
    } catch (err) {
      console.error(`[claude-code] run ${opts.runId}: PTY write failed:`, err);
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
  models: [
    { id: "opus", label: "Opus" },
    { id: "sonnet", label: "Sonnet" },
    { id: "haiku", label: "Haiku" },
  ],
  capabilities: {
    sessionResume: true,
    sessionIdCapture: true,
    hooks: true,
    // Claude transcripts carry per-message `usage` (input/output/cache tokens),
    // parsed by lib/sessions/parseClaude.ts and priced by lib/usage/pricing.ts,
    // so cost parsing is real for this runtime.
    transcriptCostParsing: true,
    externalTerminalEscape: true,
  },
  detect: async () => detectClaude(),
  spawn: spawnClaude,
  formatResumeCommand: (sid) => `claude --resume ${sid}`,
};
