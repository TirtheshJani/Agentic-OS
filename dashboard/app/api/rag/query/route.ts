import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { retrieve } from "@/lib/rag/retrieval";

export const dynamic = "force-dynamic";

interface QueryBody {
  q?: string;
  k?: number;
  scope?: { pathPrefix?: string; paths?: string[] };
  excludeThreads?: boolean;
}

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: QueryBody;
  try {
    body = (await req.json()) as QueryBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const q = body.q?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  try {
    const result = await retrieve({
      q,
      k: body.k,
      scope: body.scope,
      excludeThreads: body.excludeThreads,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[rag] query failed:", err);
    return NextResponse.json({ error: "retrieval failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  await ensureServerBooted();
  openDb();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });
  try {
    const result = await retrieve({ q });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[rag] query failed:", err);
    return NextResponse.json({ error: "retrieval failed" }, { status: 500 });
  }
}
