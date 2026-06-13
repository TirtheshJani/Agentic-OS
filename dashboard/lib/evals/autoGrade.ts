// dashboard/lib/evals/autoGrade.ts
// run.finalized listener (spec 0020): metrics always (free, deterministic);
// the LLM judge only when BOTH evals.autoGradeEnabled and the global autonomy
// switch are on. Never by default.
import { subscribe } from "@/lib/stream";
import { getSettings } from "@/lib/settings";
import { gradeRunMetrics, gradeRunWithJudge } from "@/lib/evals/store";
import { fileRevision } from "@/lib/evals/revise";

interface WorkerState {
  stop: () => void;
}

const globalKey = Symbol.for("agentic-os.evalAutoGrade");
const g = globalThis as unknown as Record<symbol, WorkerState | undefined>;

export function startEvalAutoGrade(): () => void {
  if (g[globalKey]) return g[globalKey]!.stop;
  const unsubscribe = subscribe(async (event) => {
    if (event.kind !== "run.finalized") return;
    try {
      gradeRunMetrics(event.runId);
    } catch (err) {
      console.error(`[evals] metrics failed for run ${event.runId}:`, err);
    }
    const settings = getSettings();
    if (settings.evals.autoGradeEnabled && settings.autonomy.enabled && event.exitStatus === "done") {
      const result = await gradeRunWithJudge(event.runId);
      if (!result.ok) {
        console.error(`[evals] auto-judge failed for run ${event.runId}: ${result.error}`);
      } else if (result.score < settings.evals.reviseThreshold) {
        // Reflection loop (spec 0026): one revision when the grade is sub-threshold.
        try {
          fileRevision(event.runId);
        } catch (err) {
          console.error(`[evals] revision failed for run ${event.runId}:`, err);
        }
      }
    }
  });
  const stop = () => {
    unsubscribe();
    g[globalKey] = undefined;
  };
  g[globalKey] = { stop };
  return stop;
}
