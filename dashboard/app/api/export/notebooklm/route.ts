import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { exportBundle } from "@/lib/export/notebooklm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: { paths?: string[]; bundleName?: string };
  try {
    body = (await req.json()) as { paths?: string[]; bundleName?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.paths) || body.paths.length === 0) {
    return NextResponse.json({ error: "paths is required" }, { status: 400 });
  }
  try {
    const result = exportBundle({ paths: body.paths, bundleName: body.bundleName });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
