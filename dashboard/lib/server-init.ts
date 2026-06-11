import { startWatcher } from "@/lib/watcher";
import { registerRuntime } from "@/lib/runtime/registry";
import { claudeCodeRuntime } from "@/lib/runtime/claude-code";
import { geminiCliRuntime } from "@/lib/runtime/gemini-cli";
import { startAutoRouter } from "@/lib/orchestrator/autoRoute";
import { startScheduler } from "@/lib/scheduler";
import { openDb } from "@/lib/db";
import { indexVault, startVaultWatcher } from "@/lib/vault/indexer";
import { pruneEmbeddingCache } from "@/lib/rag/chunkSync";
import { startEmbedWorker } from "@/lib/rag/embedWorker";
import { startLightragIngestWorker } from "@/lib/lightrag/ingestWorker";
import { startSessionScanner } from "@/lib/sessions/service";

let booted = false;
let bootPromise: Promise<void> | null = null;

export async function ensureServerBooted(): Promise<void> {
  if (booted) return;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    openDb();
    await startWatcher();
    registerRuntime(claudeCodeRuntime);
    registerRuntime(geminiCliRuntime);
    // Singleton-guarded via globalThis; the router and scheduler no-op while
    // the autonomy kill switch is off. server.ts triggers this boot with a
    // warm-up request so nothing waits for the first human page load.
    startAutoRouter();
    startScheduler();
    try {
      const stats = indexVault();
      console.log(`[vault] indexed: ${stats.notes} notes, ${stats.links} links`);
    } catch (err) {
      console.error("[vault] initial index failed:", err);
    }
    startVaultWatcher();
    try {
      const pruned = pruneEmbeddingCache();
      if (pruned > 0) console.log(`[rag] pruned ${pruned} stale embeddings`);
    } catch (err) {
      console.error("[rag] embedding cache prune failed:", err);
    }
    startEmbedWorker();
    startLightragIngestWorker();
    startSessionScanner();
    booted = true;
  })();
  return bootPromise;
}
