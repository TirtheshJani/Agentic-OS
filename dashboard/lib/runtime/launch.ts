import path from "node:path";

export interface LaunchSpec {
  /** The executable to hand to node-pty / child_process. */
  file: string;
  /** Argv for that executable (already adjusted for any shell wrapper). */
  args: string[];
}

/** A real Windows executable that CreateProcess can launch directly. */
function isWindowsExe(bin: string): boolean {
  return path.extname(bin).toLowerCase() === ".exe";
}

/**
 * Resolve how to actually launch a CLI across platforms.
 *
 * On Windows, npm-installed CLIs (`claude`, `gemini`, ...) are `.cmd`/`.bat`
 * shims. node-pty (and child_process without `shell:true`) call `CreateProcess`,
 * which CANNOT execute a batch file directly — it only runs real `.exe`s. The
 * launch must go through `cmd.exe /c <bin> <args>`. The previous code spawned
 * `claude.cmd` directly, which fails on Windows even though `--version`
 * detection worked (detection used `spawnSync(..., { shell: true })`). That gap
 * is why a run could get stuck: the runtime showed "available" but the PTY spawn
 * never produced a working process.
 *
 * Rule:
 *  - win32 + not a `.exe`  -> wrap in `cmd.exe /c` (covers `claude`, `claude.cmd`,
 *    `gemini.cmd`; `cmd.exe` resolves the shim via PATH/PATHEXT).
 *  - win32 + `.exe` (e.g. `agy.exe`, absolute path) -> launch directly.
 *  - posix -> launch directly.
 *
 * IMPORTANT: only pass static, shell-safe tokens (flags, model ids, uuids)
 * through here. Arbitrary text (an issue body / prompt) must NOT be wrapped in
 * the `cmd.exe` command line — cmd.exe re-parses `& | < > ^ % "` and would
 * mangle it. Prompts are delivered into the PTY instead (see the runtime
 * spawners), which is binary-safe.
 *
 * Pure: `platform` is injectable so this is unit-testable without spawning.
 */
export function resolveLaunch(opts: {
  bin: string;
  args: string[];
  platform?: NodeJS.Platform;
}): LaunchSpec {
  const platform = opts.platform ?? process.platform;
  if (platform === "win32" && !isWindowsExe(opts.bin)) {
    const comspec = process.env.ComSpec || "cmd.exe";
    return { file: comspec, args: ["/c", opts.bin, ...opts.args] };
  }
  return { file: opts.bin, args: opts.args };
}
