import * as pty from "node-pty";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { Runtime, SpawnOpts, SpawnedRun, RuntimeAvailability } from "@/lib/runtime/types";
import { installSessionStartHook } from "@/lib/runtime/hookInstaller";
import { watchForJsonlSessionId } from "@/lib/runtime/sessionIdCapture";
import { resolveLaunch } from "@/lib/runtime/launch";
import { probeVersion } from "@/lib/runtime/detect";
import { injectPrompt } from "@/lib/runtime/promptInjector";
import { REPO_ROOT } from "@/lib/paths";

/**
 * Pre-accept the "Do you trust the files in this folder?" dialog for a worktree.
 *
 * `--dangerously-skip-permissions` bypasses per-tool permission prompts but NOT
 * the one-time folder-trust dialog, which claude shows on first launch in any
 * directory it has not seen (trust is per-exact-path and does not inherit from a
 * trusted parent). That dialog blocks the input, so the prompt we type lands in
 * the dialog and is lost — the agent then sits idle at an empty prompt. Gemini
 * solves the equivalent with `--skip-trust`; claude has no such flag, so we set
 * the trust flag directly in ~/.claude.json (the file claude reads at startup)
 * before spawning. Best-effort: a malformed or missing file is non-fatal (the
 * worst case is the pre-existing dialog behavior).
 */
export function preTrustWorktree(worktreePath: string): void {
  const configPath = path.join(os.homedir(), ".claude.json");
  let config: { projects?: Record<string, Record<string, unknown>> } = {};
  try {
    if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return; // unreadable/unparseable: leave it alone
  }
  // claude stores project keys with forward slashes even on Windows.
  const key = worktreePath.replace(/\\/g, "/");
  config.projects = config.projects ?? {};
  config.projects[key] = {
    ...(config.projects[key] ?? {}),
    hasTrustDialogAccepted: true,
    hasCompletedProjectOnboarding: true,
    projectOnboardingSeenCount: 1,
  };
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch {
    /* non-fatal */
  }
}

const HOOK_SCRIPT_PATH = path.join(REPO_ROOT, "dashboard", "scripts", "claude-session-hook.js");

// On Windows, npm-installed CLIs are .cmd shims, not .exe; the actual PTY launch
// is routed through cmd.exe by resolveLaunch (CreateProcess cannot exec a .cmd
// directly). Resolved per call (not at module load) so an env override applies
// even when set after the server booted, and so tests can point it at a stub.
function claudeBin(): string {
  return process.env.AGENTIC_OS_CLAUDE_BIN || (process.platform === "win32" ? "claude.cmd" : "claude");
}

function detectClaude(): Promise<RuntimeAvailability> {
  return probeVersion(claudeBin(), "claude not on PATH (npm i -g @anthropic-ai/claude-code)");
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
  // 0. Pre-accept the folder-trust dialog for this worktree. Without this the
  // dialog swallows the typed prompt and the agent sits idle (see preTrustWorktree).
  preTrustWorktree(opts.worktreePath);
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
  const launch = resolveLaunch({ bin: claudeBin(), args: claudeSpawnArgs(opts.model) });
  const term = pty.spawn(launch.file, launch.args, {
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

  // 4. Deliver the issue body once the TUI has rendered and gone quiet, rather
  // than after a fixed delay (the old 5s guess dropped the prompt on slow/cold
  // machines, leaving the agent idle). blindEnterMs sends one early Enter to
  // dismiss any first-run "Quick safety check" dialog; --dangerously-skip-
  // permissions normally suppresses it, and an empty Enter on the input line is
  // a no-op, so this is harmless either way.
  const disposeInject = injectPrompt(term, opts.initialPrompt, {
    blindEnterMs: 1200,
    log: (m) => console.log(`[claude-code] run ${opts.runId}: ${m}`),
  });

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
      disposeInject();
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
  detect: detectClaude,
  spawn: spawnClaude,
  formatResumeCommand: (sid) => `claude --resume ${sid}`,
};
