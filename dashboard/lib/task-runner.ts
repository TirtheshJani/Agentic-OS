import type { TaskRow } from "./db";
import { executeRun } from "./run-execution";

/**
 * Fire-and-forget spawn for a task whose assignee is a named member agent.
 * Lead-assigned tasks (`lead:*`) are routed via the manual Tick button and
 * are skipped here, as are tasks assigned to the human operator.
 *
 * Calls executeRun directly so we no longer self-fetch the dashboard's own
 * /api/run endpoint (which broke whenever `next dev` chose a port other
 * than 3000). Errors are logged but never propagated; the calling route
 * should return its response to the user immediately and not wait on this
 * spawn. The subprocess outlives this function via the promise chain.
 */
export function spawnTaskIfNamed(task: TaskRow): void {
  if (!task) return;
  if (task.assignee.startsWith("lead:")) return;
  if (task.assignee === "user") return;

  void executeRun({
    prompt: task.prompt,
    agent: task.assignee,
    taskId: task.id,
  }).catch((e) => {
    // executeRun finishes the task row on subprocess errors. A throw here
    // means validation failed or something unexpected blew up before the
    // subprocess started; the task may be left in pending/running state.
    console.error(
      `[task-runner] spawn failed for task ${task.id} (${task.assignee}): ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  });
}
