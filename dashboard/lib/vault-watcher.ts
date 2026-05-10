import chokidar from "chokidar";
import path from "node:path";
import { vaultPath } from "./paths";
import { recordVaultChange } from "./db";

let started = false;

export function startVaultWatcher() {
  if (started) return;
  started = true;
  const watcher = chokidar.watch(vaultPath, {
    ignored: (p) => p.includes("/.obsidian/") || p.endsWith(".gitkeep"),
    ignoreInitial: true,
    persistent: true,
  });
  for (const kind of ["add", "change", "unlink"] as const) {
    watcher.on(kind, (full) => {
      const rel = path.relative(vaultPath, full);
      recordVaultChange(rel, kind);
    });
  }
}
