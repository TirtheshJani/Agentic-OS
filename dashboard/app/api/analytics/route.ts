import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { getAnalytics } from "@/lib/usage/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureServerBooted();
  openDb();
  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days");
  const from = days && days !== "all" ? Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000 : undefined;
  const result = getAnalytics({
    from,
    provider: searchParams.get("provider") ?? undefined,
    projectSlug: searchParams.get("project") ?? undefined,
  });
  return NextResponse.json(result);
}
