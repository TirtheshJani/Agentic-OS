import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { createNote, updateNote } from "@/lib/vault/noteWriter";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: { folder?: string; title?: string; content?: string };
  try {
    body = (await req.json()) as { folder?: string; title?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.folder || !body.title || typeof body.content !== "string") {
    return NextResponse.json({ error: "folder, title, and content are required" }, { status: 400 });
  }
  try {
    const created = createNote({ folder: body.folder, title: body.title, content: body.content });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: { path?: string; content?: string };
  try {
    body = (await req.json()) as { path?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.path || typeof body.content !== "string") {
    return NextResponse.json({ error: "path and content are required" }, { status: 400 });
  }
  try {
    updateNote(body.path, body.content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
