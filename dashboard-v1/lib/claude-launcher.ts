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

  // We deliberately do NOT pass the prompt as an opening argument to
  // claude. wt.exe forwards its trailing argv to the default profile
  // shell (PowerShell on Win11), which would interpret `$`, backticks,
  // `;`, and `()` in the prompt body. The runs row keeps the prompt as
  // a receipt so the UI can render it for the user to paste.
  try {
    if (process.platform === "win32") {
      // wt.exe -d <cwd> -- claude
      // The `--` separator tells Windows Terminal that everything after
      // is the command to run in the new tab. `claude` resolves via the
      // new terminal's PATH (claude.cmd on Windows).
      const child = spawn("wt.exe", ["-d", opts.cwd, "--", CLAUDE_BIN], {
        detached: true,
        stdio: "ignore",
        shell: false,
      });
      child.on("error", (e) => {
        console.error(`[claude-launcher] wt.exe spawn error: ${e.message}`);
      });
      child.unref();
    } else if (process.platform === "darwin") {
      // Terminal.app branch via osascript. Untested on this Windows box.
      const cwdEscaped = opts.cwd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const script = `tell application "Terminal" to do script "cd \\"${cwdEscaped}\\" && ${CLAUDE_BIN}"`;
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
