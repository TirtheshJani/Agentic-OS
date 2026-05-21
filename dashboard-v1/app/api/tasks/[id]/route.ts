import { getTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const task = getTask(n);
  if (!task) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ task });
}
