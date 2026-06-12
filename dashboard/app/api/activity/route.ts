import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { listRecentRunsWithIssues } from "@/lib/runs";

openDb();

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    active: listRecentRunsWithIssues({ activeOnly: true, limit: 20 }),
    recent: listRecentRunsWithIssues({ limit: 50 }),
  });
}
