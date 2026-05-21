import { childrenOf, getTask } from "@/lib/tasks";
import type { TaskRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const root = getTask(n);
  if (!root) return Response.json({ error: "not found" }, { status: 404 });

  // Walk up to find the topmost ancestor
  let top: TaskRow = root;
  const seen = new Set<number>([top.id]);
  while (top.parent_task_id !== null) {
    const parent = getTask(top.parent_task_id);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    top = parent;
  }

  // BFS down from top
  const tree: { task: TaskRow; children: TaskRow[] }[] = [];
  const stack: TaskRow[] = [top];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const kids = childrenOf(cur.id);
    tree.push({ task: cur, children: kids });
    for (const k of kids) {
      if (!seen.has(k.id)) {
        seen.add(k.id);
        stack.push(k);
      }
    }
  }

  return Response.json({ root: top, tree });
}
