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
  console.log(`[claude-code.spawn] run ${opts.runId}: cwd=${opts.worktreePath}, prompt length=${opts.initialPrompt.length}`);
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

  // 4. Wait for the agent's prompt to be ready, then send the issue body.
  // The 1200ms delay is empirical and may need tuning per machine. The fix-it
  // path is to bump PROMPT_READY_DELAY_MS, not to add prompt-marker detection
  // (which would be runtime-specific and brittle).
  const PROMPT_READY_DELAY_MS = 1200;
  setTimeout(() => {
    try {
      const body = opts.initialPrompt.trim();
      if (body.length > 0) {
        console.log(`[claude-code] run ${opts.runId}: writing initial prompt (${body.length} chars) to PTY`);
        // Carriage return is what cooked-mode terminal driver maps to newline.
        term.write(body + "\r");
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
  detect: async () => detectClaude(),
  spawn: spawnClaude,
  formatResumeCommand: (sid) => `claude --resume ${sid}`,
};
