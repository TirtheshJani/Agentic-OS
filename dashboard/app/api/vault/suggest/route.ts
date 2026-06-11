import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { suggestNotes } from "@/lib/vault/noteWriter";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureServerBooted();
  openDb();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  return NextResponse.json({ suggestions: suggestNotes(q) });
}
