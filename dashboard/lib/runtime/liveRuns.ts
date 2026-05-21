import type { SpawnedRun } from "@/lib/runtime/types";
import { attachSessionId } from "@/lib/runs";

const live = new Map<number, SpawnedRun>();
const sidWaiters = new Map<number, Array<(sid: string) => void>>();

/**
 * Track a spawned run for the lifetime of its PTY. Wires the runtime's session_id
 * resolution to two consumers: (1) the runs table (via attachSessionId), and
 * (2) any callers blocked on waitForSessionId.
 */
export function registerLiveRun(runId: number, spawned: SpawnedRun): void {
  live.set(runId, spawned);
  spawned.onSessionId((sid) => {
    // (1) Persist. If notifyExternalSessionId already wrote it, this is a no-op
    // because attachSessionId is an UPDATE and the value is the same.
    try {
      attachSessionId(runId, sid);
    } catch (err) {
      console.error(`[liveRuns] failed to persist session_id for run ${runId}:`, err);
    }
    // (2) Notify external waiters.
    const list = sidWaiters.get(runId);
    if (list) {
      sidWaiters.delete(runId);
      for (const w of list) {
        try { w(sid); } catch (err) { console.error("[liveRuns] waiter threw:", err); }
      }
    }
  });
}

export function getLiveRun(runId: number): SpawnedRun | null {
  return live.get(runId) ?? null;
}

export function dropLiveRun(runId: number): void {
  const r = live.get(runId);
  if (r) {
    void r.cleanup();
    live.delete(runId);
  }
  sidWaiters.delete(runId);
}

export function listLiveRunIds(): number[] {
  return Array.from(live.keys());
}

/**
 * Called by the SessionStart hook callback endpoint when the hook posts a session_id.
 * Routes through the spawned run's notifySessionId, which converges with the jsonl
 * watch path inside the runtime. The runtime's resolved callback then fires the
 * onSessionId listener registered in registerLiveRun, which handles persistence
 * and external waiters in one place.
 */
export function notifyExternalSessionId(runId: number, sessionId: string): void {
  const spawned = live.get(runId);
  if (spawned) {
    spawned.notifySessionId(sessionId);
    return;
  }
  // The run is no longer live (ended or never registered). Persist directly so we
  // don't lose the value. No waiters can exist for a non-live run.
  try {
    attachSessionId(runId, sessionId);
  } catch (err) {
    console.error(`[liveRuns] failed to persist late session_id for run ${runId}:`, err);
  }
}

/**
 * Promise that resolves when session_id arrives for the given run. Used by
 * callers that need to block until the agent is fully addressable (e.g., the
 * "Open in terminal" button which builds `claude --resume <sid>`).
 */
export function waitForSessionId(runId: number, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onSid = (sid: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve(sid);
    };
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      const list = sidWaiters.get(runId);
      if (list) sidWaiters.set(runId, list.filter(w => w !== onSid));
      reject(new Error(`Timeout waiting for session_id on run ${runId}`));
    }, timeoutMs);
    const existing = sidWaiters.get(runId) ?? [];
    existing.push(onSid);
    sidWaiters.set(runId, existing);
  });
}
