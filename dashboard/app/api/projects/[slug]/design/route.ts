import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getProject } from "@/lib/projects";
import { listCanvases, listDesignDocs } from "@/lib/design/canvases";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug } = await params;
  if (!getProject(slug)) return NextResponse.json({ error: "project not found" }, { status: 404 });
  try {
    return NextResponse.json({ canvases: listCanvases(slug), docs: listDesignDocs(slug) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
