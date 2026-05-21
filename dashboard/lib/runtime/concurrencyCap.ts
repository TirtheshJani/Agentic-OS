import { listActiveRuns, listActiveRunsForProject } from "@/lib/runs";
import { ConcurrencyCapError } from "@/lib/runtime/types";

interface CapOpts {
  projectSlug: string;
  perProjectMax: number;
  globalMax: number;
}

export function assertCapacity(opts: CapOpts): void {
  const projectActive = listActiveRunsForProject(opts.projectSlug).length;
  if (projectActive >= opts.perProjectMax) {
    throw new ConcurrencyCapError("project", opts.perProjectMax, projectActive);
  }
  const globalActive = listActiveRuns().length;
  if (globalActive >= opts.globalMax) {
    throw new ConcurrencyCapError("global", opts.globalMax, globalActive);
  }
}

export function getCapacityStatus(opts: { projectSlug: string }): {
  projectActive: number;
  globalActive: number;
} {
  return {
    projectActive: listActiveRunsForProject(opts.projectSlug).length,
    globalActive: listActiveRuns().length,
  };
}
