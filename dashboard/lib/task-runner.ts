import type { TaskRow } from "./db";

const BASE = process.env.AGENTIC_OS_BASE_URL ?? "http://localhost:3000";

/**
 * Fire-and-forget POST to /api/run for a task whose assignee is a named
 * member agent. Lead-assigned tasks (`lead:*`) are routed via the manual
 * Tick button and are skipped here.
 *
 * Drains the SSE response so the /api/run stream can close cleanly. Errors
 * are logged but never propagated — the calling route should return its
 * response to the user immediately and not wait on this spawn.
 */
export function spawnTaskIfNamed(task: TaskRow): void {
  if (!task) return;
  if (task.assignee.startsWith("lead:")) return;
  if (task.assignee === "user") return;

  const url = `${BASE}/api/run`;
  const body = JSON.stringify({
    prompt: task.prompt,
    agent: task.assignee,
    taskId: task.id,
  });

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })
    .then(async (res) => {
      if (!res.body) return;
      const reader = res.body.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
      }
    })
    .catch((e) => {
      // Server not running, port closed, or fetch failed mid-stream. The
      // task stays in its current state; a future Tick or manual run can
      // pick it up.
      console.error(
        `[task-runner] spawn failed for task ${task.id} (${task.assignee}): ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    });
}
