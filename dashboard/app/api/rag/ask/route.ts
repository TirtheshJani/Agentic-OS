import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { askVault } from "@/lib/rag/ask";

export const dynamic = "force-dynamic";

interface AskBody {
  q?: string;
  k?: number;
  scope?: { pathPrefix?: string; paths?: string[] };
}

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: AskBody;
  try {
    body = (await req.json()) as AskBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const q = body.q?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  try {
    const result = await askVault({ q, k: body.k, scope: body.scope });
    if (result.error) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[rag] ask failed:", err);
    return NextResponse.json({ error: "ask failed" }, { status: 500 });
  }
}
