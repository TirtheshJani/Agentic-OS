import { startTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  let body: { runId?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.runId !== "number") {
    return Response.json({ error: "runId required" }, { status: 400 });
  }
  try {
    const task = startTask(n, body.runId);
    if (!task) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ task });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
