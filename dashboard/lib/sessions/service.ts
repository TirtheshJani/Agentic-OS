// dashboard/lib/sessions/service.ts
// Background session scanner: boot scan + 5-minute interval. Singleton on
// globalThis (dual-module-graph pattern, same as the vault watcher).
import { scanSessions } from "@/lib/sessions/scanner";
import { publish } from "@/lib/stream";

const SCAN_INTERVAL_MS = 5 * 60_000;

interface ScannerState {
  stop: () => void;
}

const globalKey = Symbol.for("agentic-os.sessionScanner");
const g = globalThis as unknown as Record<symbol, ScannerState | undefined>;

function runScan(): void {
  try {
    const stats = scanSessions();
    if (stats.updated > 0 || stats.removed > 0) {
      console.log(`[sessions] scanned ${stats.scanned}, updated ${stats.updated}, removed ${stats.removed}`);
    }
    publish({ kind: "sessions.indexed", scanned: stats.scanned, updated: stats.updated });
  } catch (err) {
    console.error("[sessions] scan failed:", err);
  }
}

export function startSessionScanner(): () => void {
  if (g[globalKey]) return g[globalKey]!.stop;
  const timer = setInterval(runScan, SCAN_INTERVAL_MS);
  timer.unref();
  const stop = () => {
    clearInterval(timer);
    g[globalKey] = undefined;
  };
  g[globalKey] = { stop };
  runScan();
  return stop;
}
