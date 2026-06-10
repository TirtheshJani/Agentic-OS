import { NextResponse } from "next/server";
import { ensureServerBooted } from "@/lib/server-init";
import { listRuntimes } from "@/lib/runtime/registry";
import type { RuntimeAvailability } from "@/lib/runtime/types";

export const dynamic = "force-dynamic";

// detect() shells out to each CLI (--version), which costs 100ms+ per
// runtime. Cache availability per module instance for 60s.
const CACHE_TTL_MS = 60_000;
const availabilityCache = new Map<string, { at: number; availability: RuntimeAvailability }>();

export async function GET() {
  await ensureServerBooted();
  const runtimes = await Promise.all(
    listRuntimes().map(async (rt) => {
      const hit = availabilityCache.get(rt.id);
      let availability = hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.availability : null;
      if (!availability) {
        availability = await rt.detect();
        availabilityCache.set(rt.id, { at: Date.now(), availability });
      }
      return {
        id: rt.id,
        displayName: rt.displayName,
        capabilities: rt.capabilities,
        availability,
      };
    })
  );
  return NextResponse.json({ runtimes });
}
