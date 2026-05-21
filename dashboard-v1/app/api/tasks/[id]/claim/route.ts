import { claimTask } from "@/lib/tasks";
import { spawnTaskIfNamed } from "@/lib/task-runner";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { assignee?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.assignee || typeof body.assignee !== "string") {
    return Response.json({ error: "assignee required" }, { status: 400 });
  }
  try {
    const task = claimTask(n, body.assignee);
    if (!task) return Response.json({ error: "not found" }, { status: 404 });
    spawnTaskIfNamed(task);
    return Response.json({ task });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
