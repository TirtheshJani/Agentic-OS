import { execFile } from "node:child_process";
import { resolveLaunch } from "@/lib/runtime/launch";
import type { RuntimeAvailability } from "@/lib/runtime/types";

/**
 * Probe a CLI's `--version` without blocking the event loop.
 *
 * Detection previously used the SYNCHRONOUS `spawnSync`, which freezes the
 * dashboard's single-threaded server while each child process starts (process
 * spawn is slow on Windows) — a source of UI jank. `execFile` is async, so the
 * server stays responsive. Launch resolution goes through `resolveLaunch`, so a
 * Windows `.cmd` shim is run via `cmd.exe /c` (no `shell:true` needed) and a
 * real `.exe` is launched directly.
 */
export function probeVersion(bin: string, notInstalledHint: string): Promise<RuntimeAvailability> {
  const launch = resolveLaunch({ bin, args: ["--version"] });
  return new Promise((resolve) => {
    execFile(
      launch.file,
      launch.args,
      { encoding: "utf8", timeout: 15_000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const detail = (stderr && stderr.trim()) || (err as NodeJS.ErrnoException).code || err.message;
          resolve({ available: false, version: null, error: detail || notInstalledHint });
          return;
        }
        const text = `${stdout ?? ""}`.trim();
        const m = text.match(/(\d+\.\d+\.\d+)/);
        resolve({ available: true, version: m ? m[1] : text });
      }
    );
  });
}
