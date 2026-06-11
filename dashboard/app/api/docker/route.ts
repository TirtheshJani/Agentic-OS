import { NextResponse } from "next/server";
import { ensureServerBooted } from "@/lib/server-init";
import { getSettings } from "@/lib/settings";
import { dockerAvailable, listStacks, listContainers } from "@/lib/docker";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureServerBooted();
  if (!getSettings().docker.enabled) {
    return NextResponse.json({ error: "docker management is disabled in settings" }, { status: 403 });
  }
  const available = dockerAvailable();
  if (!available.daemon) {
    return NextResponse.json({ available, stacks: [], containers: [], allowlist: getSettings().docker.allowlist });
  }
  return NextResponse.json({
    available,
    stacks: listStacks(),
    containers: listContainers(),
    allowlist: getSettings().docker.allowlist,
  });
}
