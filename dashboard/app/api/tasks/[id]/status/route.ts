import { getTask, transitionTask } from "@/lib/tasks";
import { spawnTaskIfNamed } from "@/lib/task-runner";
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

  return Response.json({ task });
}
