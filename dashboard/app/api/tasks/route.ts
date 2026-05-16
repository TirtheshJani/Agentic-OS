import { createTask, getTask, listTasks } from "@/lib/tasks";
import { spawnTaskIfNamed } from "@/lib/task-runner";
import type { TaskStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS: TaskStatus[] = ["queued", "claimed", "running", "done", "failed"];

export async function POST(req: Request) {
  let body: {
    prompt?: string;
    assignee?: string;
    department?: string;
    parentTaskId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.prompt || typeof body.prompt !== "string") {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  if (!body.assignee || typeof body.assignee !== "string") {
    return Response.json({ error: "assignee required" }, { status: 400 });
  }
  if (body.prompt.length > 32_000) {
    return Response.json({ error: "prompt too large" }, { status: 413 });
  }
  const id = createTask({
    prompt: body.prompt,
    assignee: body.assignee,
    department: body.department ?? null,
    parentTaskId: typeof body.parentTaskId === "number" ? body.parentTaskId : null,
  });
  const task = getTask(id);
  if (task) spawnTaskIfNamed(task);
  return Response.json({ id }, { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as TaskStatus | null;
  const department = url.searchParams.get("department");
  const assignee = url.searchParams.get("assignee");
  if (status && !VALID_STATUS.includes(status)) {
    return Response.json({ error: `invalid status (must be one of ${VALID_STATUS.join(", ")})` }, { status: 400 });
  }
  const tasks = listTasks({
    status: status ?? undefined,
    department: department ?? undefined,
    assignee: assignee ?? undefined,
    limit: 50,
  });
  return Response.json({ tasks });
}
