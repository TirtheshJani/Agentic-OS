import { startWatcher } from "@/lib/watcher";
import { registerRuntime } from "@/lib/runtime/registry";
import { claudeCodeRuntime } from "@/lib/runtime/claude-code";
import { geminiCliRuntime } from "@/lib/runtime/gemini-cli";
import { startAutoRouter } from "@/lib/orchestrator/autoRoute";
import { startScheduler } from "@/lib/scheduler";

let booted = false;
let bootPromise: Promise<void> | null = null;

export async function ensureServerBooted(): Promise<void> {
  if (booted) return;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    await startWatcher();
    registerRuntime(claudeCodeRuntime);
    registerRuntime(geminiCliRuntime);
    // Both are singleton-guarded via globalThis and no-op while the autonomy
    // kill switch is off. server.ts triggers this boot with a warm-up request
    // so they start without waiting for the first human page load.
    startAutoRouter();
    startScheduler();
    booted = true;
  })();
  return bootPromise;
}
