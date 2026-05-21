// dashboard/lib/terminal/openExternal.ts
import { spawn } from "node:child_process";
import os from "node:os";

interface OpenOpts {
  cwd: string;
  command: string;
}

/**
 * Open the operator's preferred terminal at the given cwd, running the given command.
 * Platform detection: Windows uses wt.exe, macOS uses iTerm (falls back to Terminal.app), Linux uses $TERMINAL or gnome-terminal.
 */
export function openExternalTerminal(opts: OpenOpts): { ok: boolean; error?: string } {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      // Windows Terminal: wt.exe -d <cwd> <command>
      // wt.exe parses its args specially; pass the command as a single string after `--`.
      spawn("wt.exe", ["-d", opts.cwd, "cmd.exe", "/k", opts.command], { detached: true, stdio: "ignore" }).unref();
      return { ok: true };
    }

    if (platform === "darwin") {
      // iTerm is preferred if installed; fall back to Terminal.app via osascript.
      const fs = require("node:fs");
      const iterm = "/Applications/iTerm.app";
      if (fs.existsSync(iterm)) {
        const script = `
          tell application "iTerm"
            activate
            create window with default profile
            tell current session of current window
              write text "cd ${shellEscape(opts.cwd)} && ${opts.command}"
            end tell
          end tell
        `;
        spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" }).unref();
      } else {
        const script = `
          tell application "Terminal"
            do script "cd ${shellEscape(opts.cwd)} && ${opts.command}"
            activate
          end tell
        `;
        spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" }).unref();
      }
      return { ok: true };
    }

    // Linux / WSL
    const term = process.env.TERMINAL;
    if (term) {
      spawn(term, ["-e", "bash", "-c", `cd '${opts.cwd}' && ${opts.command}; exec bash`], {
        detached: true,
        stdio: "ignore",
      }).unref();
      return { ok: true };
    }
    // Try common terminals in order.
    for (const candidate of ["gnome-terminal", "konsole", "xterm", "alacritty"]) {
      try {
        if (candidate === "gnome-terminal") {
          spawn("gnome-terminal", ["--working-directory", opts.cwd, "--", "bash", "-c", `${opts.command}; exec bash`], {
            detached: true,
            stdio: "ignore",
          }).unref();
        } else if (candidate === "konsole") {
          spawn("konsole", ["--workdir", opts.cwd, "-e", "bash", "-c", `${opts.command}; exec bash`], {
            detached: true,
            stdio: "ignore",
          }).unref();
        } else {
          spawn(candidate, ["-e", "bash", "-c", `cd '${opts.cwd}' && ${opts.command}; exec bash`], {
            detached: true,
            stdio: "ignore",
          }).unref();
        }
        return { ok: true };
      } catch {
        continue;
      }
    }
    return { ok: false, error: "No terminal emulator found. Set $TERMINAL or install gnome-terminal." };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function shellEscape(s: string): string {
  return s.replace(/(["\\$`])/g, "\\$1");
}
