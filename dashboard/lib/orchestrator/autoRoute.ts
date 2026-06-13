import { subscribe, publish } from "@/lib/stream";
import { getIssue, listIssues, updateIssue } from "@/lib/issues";
import { getProject } from "@/lib/projects";
import { listAgents } from "@/lib/agents";
import { getSettings } from "@/lib/settings";
import { appendEvent } from "@/lib/threads";
import { routeIssue } from "@/lib/orchestrator/router";
import { loadGlossaryTerms } from "@/lib/glossary";
import { startRunForIssue } from "@/lib/startRun";
import { ConcurrencyCapError } from "@/lib/runtime/types";
import { getDb } from "@/lib/db";
import { eligibleChildren } from "@/lib/epics";

const SWEEP_INTERVAL_MS = 60_000;

interface RouterState {
  stop: () => void;
  inFlight: Set<number>;
}

// Singleton across the dual module graphs (see liveRuns.ts).
const globalKey = Symbol.for("agentic-os.autoRouter");
const g = globalThis as unknown as Record<symbol, RouterState | undefined>;

export async function handleIssue(issueId: number, inFlight: Set<number>): Promise<void> {
  const settings = getSettings();
  if (!settings.autonomy.enabled) return;
  if (inFlight.has(issueId)) return;

  const issue = getIssue(issueId);
  if (!issue || issue.status !== "queued") return;

  const project = getProject(issue.projectSlug);
  if (!project) return;

  // Epic dependency gate: a child issue may only run once its depends_on issues
  // pass. eligibleChildren resolves that for the whole epic; if this issue is
  // not among them, hold it queued. Non-epic issues (epic_id null) skip this
  // and route exactly as before.
  const epicRow = getDb()
    .prepare("SELECT epic_id FROM issues WHERE id = ?")
    .get(issueId) as { epic_id: number | null } | undefined;
  const epicId = epicRow?.epic_id;
  if (epicId != null) {
    const eligible = eligibleChildren(epicId).some((c) => c.id === issueId);
    if (!eligible) {
      appendEvent({
        projectSlug: issue.projectSlug,
        issueId: issue.id,
        eventType: "orchestrator.held",
        details: "Epic dependency unmet; staying queued.",
      });
      publish({ kind: "thread.appended", issueId: issue.id });
      return;
    }
  }

  inFlight.add(issueId);
  try {
    let assignee = issue.assigneeSlug;
    // Route when unassigned, or when "assigned" to a department lead (leads
    // dispatch work, they do not execute it).
    if (!assignee || assignee.endsWith("-lead")) {
      const route = routeIssue(issue, project.capabilities, listAgents(), loadGlossaryTerms());
      if (!route.assigneeSlug) {
        appendEvent({
          projectSlug: issue.projectSlug,
          issueId: issue.id,
          eventType: "orchestrator.held",
          details: `Auto-routing found no agent (${route.reason}); staying queued.`,
        });
        publish({ kind: "thread.appended", issueId: issue.id });
        return;
      }
      assignee = route.assigneeSlug;
      updateIssue(issue.id, { assigneeSlug: assignee });
      appendEvent({
        projectSlug: issue.projectSlug,
        issueId: issue.id,
        eventType: "orchestrator.routed",
        details: `Auto-routed to ${assignee}: ${route.reason}`,
      });
      publish({ kind: "issue.changed", id: issue.id, projectSlug: issue.projectSlug, reason: "update" });
      publish({ kind: "thread.appended", issueId: issue.id });
    }

    try {
      await startRunForIssue(issue.id);
    } catch (err) {
      if (err instanceof ConcurrencyCapError) {
        // Stay queued; the next sweep retries when capacity frees up.
        console.log(`[autoRoute] issue ${issue.id} held at cap (${err.scope} ${err.active}/${err.cap})`);
        return;
      }
      // A real spawn failure: mark failed so the loop cannot spin on it.
      console.error(`[autoRoute] start failed for issue ${issue.id}:`, err);
      updateIssue(issue.id, { status: "failed" });
      appendEvent({
        projectSlug: issue.projectSlug,
        issueId: issue.id,
        eventType: "orchestrator.failed",
        details: `Auto-start failed: ${(err as Error).message}`,
      });
      publish({ kind: "issue.changed", id: issue.id, projectSlug: issue.projectSlug, reason: "status" });
      publish({ kind: "thread.appended", issueId: issue.id });
    }
  } finally {
    inFlight.delete(issueId);
  }
}

function sweep(inFlight: Set<number>): void {
  const settings = getSettings();
  if (!settings.autonomy.enabled) return;
  for (const issue of listIssues({ status: "queued" })) {
    void handleIssue(issue.id, inFlight);
  }
}

/**
 * Event-driven routing (issue lands in Queued) plus a 60s sweep that retries
 * issues held back by concurrency caps. Idempotent: repeated calls return
 * the existing stopper.
 */
export function startAutoRouter(): () => void {
  if (g[globalKey]) return g[globalKey]!.stop;

  const inFlight = new Set<number>();
  const unsubscribe = subscribe((event) => {
    if (event.kind === "issue.changed" && event.reason !== "delete") {
      void handleIssue(event.id, inFlight);
    }
  });
  const interval = setInterval(() => sweep(inFlight), SWEEP_INTERVAL_MS);
  interval.unref?.();

  const stop = () => {
    unsubscribe();
    clearInterval(interval);
    g[globalKey] = undefined;
  };
  g[globalKey] = { stop, inFlight };
  console.log("[autoRoute] auto-router started");
  return stop;
}
