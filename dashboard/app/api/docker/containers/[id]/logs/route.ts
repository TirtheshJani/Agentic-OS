import { NextResponse } from "next/server";
import { ensureServerBooted } from "@/lib/server-init";
import { getSettings } from "@/lib/settings";
import { containerLogs } from "@/lib/docker";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureServerBooted();
  if (!getSettings().docker.enabled) {
    return NextResponse.json({ error: "docker management is disabled in settings" }, { status: 403 });
  }
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tail = Math.min(parseInt(searchParams.get("tail") ?? "400", 10) || 400, 2000);
  try {
    return NextResponse.json({ logs: containerLogs(id, tail) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
