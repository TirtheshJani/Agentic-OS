import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { appendToDaily } from "@/lib/vault/noteWriter";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });
  try {
    const created = appendToDaily(body.text);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
