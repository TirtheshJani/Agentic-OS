import { startWatcher } from "@/lib/watcher";
import { registerRuntime } from "@/lib/runtime/registry";
import { claudeCodeRuntime } from "@/lib/runtime/claude-code";
import { geminiCliRuntime } from "@/lib/runtime/gemini-cli";

let booted = false;
let bootPromise: Promise<void> | null = null;

export async function ensureServerBooted(): Promise<void> {
  if (booted) return;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    await startWatcher();
    registerRuntime(claudeCodeRuntime);
    registerRuntime(geminiCliRuntime);
    booted = true;
  })();
  return bootPromise;
}
