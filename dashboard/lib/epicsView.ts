// dashboard/lib/epicsView.ts
// Pure assembly for the missions (epics) surface (spec 0034). Kept out of the
// Next.js route module because a route file may only export request handlers.
import { listEpics, rollupStatus, childIssues, eligibleChildren, type Epic } from "@/lib/epics";

/** A child issue as surfaced to the epics view: dependency-ordered, eligibility flagged. */
export interface EpicChildView {
  id: number;
  title: string;
  status: string;
  dependsOn: number[];
  eligible: boolean;
}

/** An epic plus its derived rollup and dependency-ordered children. */
export interface EpicView extends Epic {
  rollup: "empty" | "in-progress" | "done";
  children: EpicChildView[];
}

/**
 * Pure view assembler (no Request, no NextResponse) so it is trivially testable.
 * For each epic it computes the rollup status and lists children in dependency
 * order: eligible (independent / deps met) first, then ineligible (blocked),
 * each preserving creation order. Eligibility reuses lib/epics.eligibleChildren.
 */
export function assembleEpicsView(projectSlug?: string): EpicView[] {
  const epics = listEpics(projectSlug ? { projectSlug } : {});
  return epics.map((epic) => {
    const children = childIssues(epic.id);
    const eligibleIds = new Set(eligibleChildren(epic.id).map((c) => c.id));
    const view: EpicChildView[] = children.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      dependsOn: c.dependsOn,
      eligible: eligibleIds.has(c.id),
    }));
    // Eligible (unblocked) children first, blocked last; stable within each group.
    view.sort((a, b) => Number(b.eligible) - Number(a.eligible));
    return { ...epic, rollup: rollupStatus(epic.id), children: view };
  });
}
