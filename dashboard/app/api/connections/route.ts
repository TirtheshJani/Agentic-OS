import { NextResponse } from "next/server";
import { getConnectionStatuses } from "@/lib/connections";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ connections: await getConnectionStatuses() });
}
