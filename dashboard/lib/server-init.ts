// dashboard/lib/server-init.ts
// Lazily boots server-side singletons on first request.
// Next.js spins up handlers on demand, so we need a sentinel.
import { startWatcher } from "@/lib/watcher";

let booted = false;
let bootPromise: Promise<void> | null = null;

export async function ensureServerBooted(): Promise<void> {
  if (booted) return;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    await startWatcher();
    booted = true;
  })();
  return bootPromise;
}
