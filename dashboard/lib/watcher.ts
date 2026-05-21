import chokidar, { FSWatcher } from "chokidar";
import { VAULT_PROJECTS_DIR, AGENTS_DIR } from "@/lib/paths";

interface StartOptions {
  projectsRoot?: string;
  agentsRoot?: string;
}

let watcher: FSWatcher | null = null;
const counts: Record<string, number> = { project: 0, agent: 0 };

export async function startWatcher(opts: StartOptions = {}): Promise<void> {
  if (watcher) return;

  const projectsRoot = opts.projectsRoot ?? VAULT_PROJECTS_DIR;
  const agentsRoot = opts.agentsRoot ?? AGENTS_DIR;

  // chokidar 4 removed glob support, so watch the roots and filter in the handler.
  watcher = chokidar.watch(
    [projectsRoot, agentsRoot],
    {
      ignoreInitial: true,
      depth: 2,
    }
  );

  watcher.on("all", (_event, filePath) => {
    if (!filePath.endsWith(".md")) return;
    if (filePath.endsWith("PROJECT.md") && filePath.startsWith(projectsRoot)) {
      counts.project += 1;
    } else if (filePath.startsWith(agentsRoot)) {
      counts.agent += 1;
    }
  });

  await new Promise<void>(resolve => {
    watcher!.on("ready", () => resolve());
  });
}

export async function stopWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
}

export function getEventCount(kind: "project" | "agent"): number {
  return counts[kind] ?? 0;
}

export function resetWatcherForTesting() {
  counts.project = 0;
  counts.agent = 0;
}
