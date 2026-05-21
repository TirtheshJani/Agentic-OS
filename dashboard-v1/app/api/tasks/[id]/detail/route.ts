import { loadIssue } from "@/lib/design/loaders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const detail = await loadIssue(n);
    if (!detail) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(detail);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
