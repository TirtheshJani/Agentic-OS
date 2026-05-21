import { createTask, getTask, listTasks } from "@/lib/tasks";
import { spawnTaskIfNamed } from "@/lib/task-runner";
import type { TaskPriority, TaskStatus } from "@/lib/db";

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
const VALID_PRIORITY: TaskPriority[] = ["low", "med", "high", "urgent"];

export async function POST(req: Request) {
  let body: {
    prompt?: string;
    assignee?: string;
    department?: string;
    parentTaskId?: number;
    projectSlug?: string;
    title?: string;
    repo?: string;
    priority?: string;
    labels?: unknown;
    githubUrl?: string;
    githubNumber?: number;
    status?: string;
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

  let priority: TaskPriority | null = null;
  if (body.priority !== undefined && body.priority !== null) {
    if (
      typeof body.priority !== "string" ||
      !VALID_PRIORITY.includes(body.priority as TaskPriority)
    ) {
      return Response.json(
        { error: `invalid priority (must be one of ${VALID_PRIORITY.join(", ")})` },
        { status: 400 }
      );
    }
    priority = body.priority as TaskPriority;
  }

  let labels: string[] | null = null;
  if (body.labels !== undefined && body.labels !== null) {
    if (
      !Array.isArray(body.labels) ||
      !body.labels.every((l) => typeof l === "string")
    ) {
      return Response.json(
        { error: "labels must be an array of strings" },
        { status: 400 }
      );
    }
    labels = body.labels as string[];
  }

  let githubNumber: number | null = null;
  if (body.githubNumber !== undefined && body.githubNumber !== null) {
    if (
      typeof body.githubNumber !== "number" ||
      !Number.isFinite(body.githubNumber) ||
      !Number.isInteger(body.githubNumber)
    ) {
      return Response.json(
        { error: "githubNumber must be a finite integer" },
        { status: 400 }
      );
    }
    githubNumber = body.githubNumber;
  }

  // Phase 8.2: only 'queued' (default) and 'backlog' may be supplied at
  // creation time. Backlog rows do NOT auto-spawn a run; queued rows do
  // (preserves the legacy behavior of this endpoint).
  let initialStatus: "queued" | "backlog" = "queued";
  if (body.status !== undefined && body.status !== null) {
    if (body.status !== "queued" && body.status !== "backlog") {
      return Response.json(
        { error: "status at creation must be 'queued' or 'backlog'" },
        { status: 400 }
      );
    }
    initialStatus = body.status;
  }

  const id = createTask({
    prompt: body.prompt,
    assignee: body.assignee,
    department: body.department ?? null,
    parentTaskId: typeof body.parentTaskId === "number" ? body.parentTaskId : null,
    projectSlug: body.projectSlug ?? null,
    title: body.title ?? null,
    repo: body.repo ?? null,
    priority,
    labels,
    githubUrl: body.githubUrl ?? null,
    githubNumber,
    status: initialStatus,
  });
  const task = getTask(id);
  if (task && initialStatus === "queued") spawnTaskIfNamed(task);
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
