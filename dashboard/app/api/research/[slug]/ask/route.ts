import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getResearchProject, researchScopePrefix } from "@/lib/research/projects";
import { askVault } from "@/lib/rag/ask";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug } = await params;
  if (!getResearchProject(slug)) return NextResponse.json({ error: "research project not found" }, { status: 404 });

  let body: { q?: string; k?: number; includePaths?: string[] };
  try {
    body = (await req.json()) as { q?: string; k?: number; includePaths?: string[] };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const q = body.q?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  try {
    const result = await askVault({
      q,
      k: body.k,
      scope: {
        pathPrefix: researchScopePrefix(slug),
        paths: body.includePaths && body.includePaths.length > 0 ? body.includePaths : undefined,
      },
    });
    return NextResponse.json(result, { status: result.error ? 502 : 200 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
