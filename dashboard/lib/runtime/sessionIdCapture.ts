import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import chokidar, { type FSWatcher } from "chokidar";

interface WatchOpts {
  projectsRoot?: string; // for testing
  timeoutMs?: number;
}

export interface JsonlWatchHandle {
  promise: Promise<string>;
  cancel: () => void;
}

function defaultProjectsRoot(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

/**
 * Per-call watch. Each invocation gets its own chokidar watcher and timeout.
 * Safe to run multiple in parallel (one per concurrent run).
 */
export function watchForJsonlSessionId(opts: WatchOpts = {}): JsonlWatchHandle {
  const root = opts.projectsRoot ?? defaultProjectsRoot();
  const timeoutMs = opts.timeoutMs ?? 15000;

  let watcher: FSWatcher | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  function cleanup() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (watcher) { watcher.close().catch(() => undefined); watcher = null; }
  }

  const promise = new Promise<string>((resolve, reject) => {
    const knownAtStart = new Set<string>();
    function scan(): string[] {
      if (!fs.existsSync(root)) return [];
      const out: string[] = [];
      for (const subdir of fs.readdirSync(root)) {
        const sub = path.join(root, subdir);
        if (!fs.statSync(sub).isDirectory()) continue;
        for (const f of fs.readdirSync(sub)) {
          if (f.endsWith(".jsonl")) out.push(path.join(sub, f));
        }
      }
      return out;
    }
    for (const f of scan()) knownAtStart.add(f);

    watcher = chokidar.watch(root, {
      ignored: /(^|[/\\])\../,
      depth: 2,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    watcher.on("add", (filePath: string) => {
      if (settled) return;
      if (!filePath.endsWith(".jsonl")) return;
      if (knownAtStart.has(filePath)) return;
      const sid = path.basename(filePath, ".jsonl");
      settled = true;
      cleanup();
      resolve(sid);
    });

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Timeout waiting for session jsonl (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      cleanup();
    },
  };
}
