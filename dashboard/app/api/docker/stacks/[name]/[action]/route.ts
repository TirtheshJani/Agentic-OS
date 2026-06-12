import { NextResponse } from "next/server";
import { ensureServerBooted } from "@/lib/server-init";
import { getSettings } from "@/lib/settings";
import { stackAction, type StackAction } from "@/lib/docker";

export const dynamic = "force-dynamic";

const ACTIONS: StackAction[] = ["start", "stop", "restart"];

export async function POST(_req: Request, { params }: { params: Promise<{ name: string; action: string }> }) {
  await ensureServerBooted();
  if (!getSettings().docker.enabled) {
    return NextResponse.json({ error: "docker management is disabled in settings" }, { status: 403 });
  }
  const { name, action } = await params;
  if (!ACTIONS.includes(action as StackAction)) {
    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }
  try {
    const result = stackAction(action as StackAction, name);
    if (!result.ok) return NextResponse.json({ error: result.output || "docker command failed" }, { status: 502 });
    return NextResponse.json({ ok: true, output: result.output });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
}
