import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { listEvals } from "@/lib/evals/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureServerBooted();
  openDb();
  const { searchParams } = new URL(req.url);
  const rows = listEvals({ projectSlug: searchParams.get("project") ?? undefined });
  return NextResponse.json({ evals: rows });
}
