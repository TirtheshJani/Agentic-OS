import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getProject } from "@/lib/projects";
import { readCanvas, saveCanvas, deleteCanvas } from "@/lib/design/canvases";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; name: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug, name } = await params;
  if (!getProject(slug)) return NextResponse.json({ error: "project not found" }, { status: 404 });
  try {
    const scene = readCanvas(slug, name);
    if (scene === null) return NextResponse.json({ error: "canvas not found" }, { status: 404 });
    return NextResponse.json({ scene });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string; name: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug, name } = await params;
  if (!getProject(slug)) return NextResponse.json({ error: "project not found" }, { status: 404 });
  let body: { scene?: unknown; svg?: string };
  try {
    body = (await req.json()) as { scene?: unknown; svg?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (body.scene == null) return NextResponse.json({ error: "scene is required" }, { status: 400 });
  try {
    saveCanvas(slug, name, body.scene, body.svg ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; name: string }> }) {
  await ensureServerBooted();
  openDb();
  const { slug, name } = await params;
  if (!getProject(slug)) return NextResponse.json({ error: "project not found" }, { status: 404 });
  try {
    if (!deleteCanvas(slug, name)) return NextResponse.json({ error: "canvas not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
