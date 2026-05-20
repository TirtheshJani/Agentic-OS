import chokidar from "chokidar";
import path from "node:path";
import { vaultPath } from "./paths";
import { recordVaultChange } from "./db";

let started = false;

export function startVaultWatcher() {
  if (started) return;
  started = true;
  const watcher = chokidar.watch(vaultPath, {
    ignored: (p) => {
      // chokidar emits backslash-separated paths on Windows; normalize before
      // running substring checks so the ignore list works cross-platform.
      const norm = p.replace(/\\/g, "/");
      return (
        norm.includes("/.obsidian/") ||
        norm.includes("/.git/") ||
        norm.includes("/node_modules/") ||
        norm.endsWith(".gitkeep")
      );
    },
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
