import { recentRuns } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ runs: recentRuns(8) });
}
