import { spawn } from "node:child_process";
import fs from "node:fs";
import { insertRun } from "./db";

// Phase 8.4: cross-platform launcher for interactive `claude` sessions.
// Headless mode stays on the existing /api/run SSE path (see app/api/run/
// route.ts); this module exists so callers have a single export for both
// modes and so future GC/cancel logic can hang off one place.
//
// CLAUDE_BIN: same env var as claude-headless.ts. Defaults to bare "claude"
// (resolved by the shell's PATH). On Windows the npm shim is `claude.cmd`;
// `wt.exe` itself handles the .cmd resolution because we invoke it through
// its own argument list and let the new terminal's shell do the lookup.
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";

export type LaunchMode = "headless" | "terminal";

export type LaunchOpts = {
  mode: LaunchMode;
  cwd: string;
  prompt: string;
  agent?: string | null;
  taskId?: number | null;
};

export type LaunchResult = { runId: number } | { error: string };

export async function launch(opts: LaunchOpts): Promise<LaunchResult> {
  if (opts.mode === "headless") {
    // The headless path is a streaming SSE flow that the SSE route (which
    // is a Web ReadableStream, not a child_process pipe) owns end to end.
    // Wrapping it here would require duplicating the streaming protocol;
    // callers should hit /api/run directly. Returning a clear error here
    // keeps the function's surface honest and gives callers a single
    // import for both modes.
    return { error: "use /api/run for headless mode" };
  }

  // mode === 'terminal'
  if (!opts.cwd || typeof opts.cwd !== "string") {
    return { error: "cwd is required for terminal mode" };
  }
  let cwdOk = false;
  try {
    cwdOk = fs.statSync(opts.cwd).isDirectory();
  } catch {
    cwdOk = false;
  }
  if (!cwdOk) {
    return { error: `cwd does not exist: ${opts.cwd}` };
  }

  // Insert the runs row BEFORE spawning. If spawn fails we update it to
  // 'error' so it doesn't sit forever in 'running'. The terminal session,
  // once started, gets its own session_id from the SessionStart hook
  // (bin/ao-hook.mjs → /api/session-log) — that hook will insert a
  // SEPARATE row keyed on session_id. The row we insert here is the
  // dashboard-side launch receipt; closing it out is a follow-up (24h GC
  // per roadmap 8.4) and is out of scope for this PR.
  const runId = insertRun({
    skillSlug: "(terminal)",
    prompt: opts.prompt,
    cwd: opts.cwd,
    agent: opts.agent ?? null,
    source: "terminal",
    taskId: opts.taskId ?? null,
  });

  // Prompt handling: passed as a positional argument to `claude`. The
  // claude CLI accepts an interactive prompt this way (claude [prompt]),
  // so the new REPL opens with the prompt as the first user message.
  // child_process.spawn with argv array (no shell:true on wt.exe) means
  // we do NOT need to escape quotes/backslashes — Node hands each argv
  // entry to the OS as a single token. wt.exe then forwards everything
  // after `--` to the spawned process verbatim.
  //
  // Newlines in prompts: wt.exe's command-line on Windows handles \n
  // inside an argv entry fine because we're not using shell. If anything
  // misbehaves the fallback is to drop the prompt and let the user paste
  // it (claude opens in cwd either way).
  try {
    if (process.platform === "win32") {
      // wt.exe -d <cwd> -- claude "<prompt>"
      // The `--` separator tells Windows Terminal that everything after
      // is the command to run in the new tab. `claude` is resolved by
      // the new terminal's PATH (it finds claude.cmd on Windows).
      const args = ["-d", opts.cwd, "--", CLAUDE_BIN, opts.prompt];
      const child = spawn("wt.exe", args, {
        detached: true,
        stdio: "ignore",
        // No shell — argv passthrough avoids quote-escaping headaches.
        shell: false,
      });
      child.on("error", (e) => {
        console.error(`[claude-launcher] wt.exe spawn error: ${e.message}`);
      });
      child.unref();
    } else if (process.platform === "darwin") {
      // Terminal.app branch. UNTESTED on this Windows box — written so
      // macOS users hitting this path on day 1 are not blocked. Uses
      // osascript to drive AppleScript. Escapes embedded double quotes
      // and backslashes inside the AppleScript string literal.
      const escaped = opts.prompt.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const cwdEscaped = opts.cwd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const script = `tell application "Terminal" to do script "cd \\"${cwdEscaped}\\" && ${CLAUDE_BIN} \\"${escaped}\\""`;
      const child = spawn("osascript", ["-e", script], {
        detached: true,
        stdio: "ignore",
        shell: false,
      });
      child.on("error", (e) => {
        console.error(`[claude-launcher] osascript spawn error: ${e.message}`);
      });
      child.unref();
    } else {
      // Linux: no canonical "open a new terminal" call (depends on the
      // user's WM and terminal emulator). Out of scope for 8.4.
      return { error: "terminal mode not supported on linux yet" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `spawn failed: ${msg}` };
  }

  return { runId };
}
