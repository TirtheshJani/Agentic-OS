import { NextResponse } from "next/server";
import { getJob } from "@/lib/createProject/jobs";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    // Also covers "the dev server restarted and in-memory jobs were lost".
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}
