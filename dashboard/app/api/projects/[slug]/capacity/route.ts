import { NextResponse } from "next/server";
import { getCapacityStatus } from "@/lib/runtime/concurrencyCap";
import { openDb } from "@/lib/db";

openDb();

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return NextResponse.json(getCapacityStatus({ projectSlug: slug }));
}
