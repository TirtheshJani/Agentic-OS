import fs from "node:fs";
import path from "node:path";
import { getTask, transitionTask } from "@/lib/tasks";
import { spawnTaskIfNamed } from "@/lib/task-runner";
import { closeIssue } from "@/lib/github-sync";
import { projectBySlug } from "@/lib/projects-loader";
import { threadsPath } from "@/lib/paths";
import type { TaskStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS: TaskStatus[] = [
  "backlog",
  "queued",
  "claimed",
  "running",
  "review",
  "done",
  "failed",
];

// Phase 8.2: manual status-override endpoint for the issues UI. Legality is
// enforced in `transitionTask`; this route validates input shape and handles
// the side effect of re-spawning a run when a task moves back to `queued`.
//
// The legacy claim/start/finish endpoints continue to work for the existing
// claim/start/finish protocol; `transitionTask` is the canonical path for
// any other state move.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.status || typeof body.status !== "string") {
    return Response.json({ error: "status required" }, { status: 400 });
  }
  if (!VALID_STATUS.includes(body.status as TaskStatus)) {
    return Response.json(
      { error: `invalid status (must be one of ${VALID_STATUS.join(", ")})` },
      { status: 400 }
    );
  }
  const next = body.status as TaskStatus;
  let task;
  try {
    task = transitionTask(n, next);
  } catch (e) {
    // Legality failure surfaces as 409 Conflict: the requested target is in
    // the union but the source state forbids it.
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 409 }
    );
  }
  if (!task) return Response.json({ error: "not found" }, { status: 404 });

  // Re-fetch on any move into queued (manual override path: e.g. user
  // promoted a backlog row, or pulled a claimed/failed task back into the
  // queue). spawnTaskIfNamed is a no-op for user/lead:* assignees and for
  // tasks the row already in-flight; it's safe to call here.
  if (next === "queued") {
    const fresh = getTask(n);
    if (fresh) spawnTaskIfNamed(fresh);
  }

  // Phase 8.5 write-back: when a card is moved to Done and the project
  // opted into write-back, mirror that to GitHub by closing the issue.
  // Failures land in the task thread; we never roll back the local
  // status change.
  if (next === "done" && task.repo && task.github_number && task.project_slug) {
    const project = projectBySlug(task.project_slug);
    if (project?.githubSync === "write-back") {
      // Fire and forget; the response should not wait on a network call.
      void (async () => {
        const r = await closeIssue(
          task.repo!,
          task.github_number!,
          "closed via dashboard"
        );
        if (!r.ok) {
          appendThreadLine(
            n,
            `gh issue close failed for ${task.repo}#${task.github_number}: ${r.error}`
          );
        } else {
          appendThreadLine(
            n,
            `gh issue close ok for ${task.repo}#${task.github_number}`
          );
        }
      })();
    }
  }

  return Response.json({ task });
}

// Append a single-line system note to the task thread. Used by the
// write-back hook to surface gh failures without rolling back the
// local status change. Best-effort: filesystem errors are swallowed.
function appendThreadLine(taskId: number, message: string): void {
  try {
    fs.mkdirSync(threadsPath, { recursive: true });
    const file = path.join(threadsPath, `${taskId}.md`);
    const line = `[${new Date().toISOString()}] system: ${message.replace(/\n/g, " ")}\n`;
    fs.appendFileSync(file, line);
  } catch {
    // The thread is a convenience surface; failing to write it should
    // never propagate to the caller of the status route.
  }
}
