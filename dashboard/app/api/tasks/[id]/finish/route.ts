import { finishTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { status?: "done" | "failed"; error?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (body.status !== "done" && body.status !== "failed") {
    return Response.json({ error: "status must be done or failed" }, { status: 400 });
  }
  const task = finishTask(n, body.status, body.error ?? null);
  if (!task) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ task });
}
