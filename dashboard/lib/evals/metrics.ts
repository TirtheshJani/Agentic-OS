// dashboard/lib/evals/metrics.ts
// Layer A: deterministic run metrics (spec 0020). Free to compute, always on.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { getDb } from "@/lib/db";
import type { Run } from "@/lib/runs";

export interface RunMetrics {
  durationMs: number | null;
  exitStatus: string | null;
  turnsUser: number | null;
  turnsAssistant: number | null;
  toolCalls: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimate: number | null;
  diffShortstat: string | null;
}

export function computeRunMetrics(run: Run): RunMetrics {
  const session = getDb()
    .prepare(
      `SELECT turns_user AS turnsUser, turns_assistant AS turnsAssistant, tool_calls AS toolCalls,
              tokens_in AS tokensIn, tokens_out AS tokensOut, cost_estimate AS costEstimate
       FROM sessions WHERE run_id = ? ORDER BY id DESC LIMIT 1`
    )
    .get(run.id) as
    | { turnsUser: number; turnsAssistant: number; toolCalls: number; tokensIn: number | null; tokensOut: number | null; costEstimate: number | null }
    | undefined;

  // Diff stats only when the worktree still exists; cleaned worktrees yield null.
  let diffShortstat: string | null = null;
  if (run.worktreePath && fs.existsSync(run.worktreePath)) {
    const r = spawnSync("git", ["-C", run.worktreePath, "diff", "--shortstat", "HEAD"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    if (r.status === 0) diffShortstat = r.stdout.trim() || "no changes";
  }

  return {
    durationMs: run.endedAt != null ? run.endedAt - run.startedAt : null,
    exitStatus: run.exitStatus ?? null,
    turnsUser: session?.turnsUser ?? null,
    turnsAssistant: session?.turnsAssistant ?? null,
    toolCalls: session?.toolCalls ?? null,
    tokensIn: session?.tokensIn ?? null,
    tokensOut: session?.tokensOut ?? null,
    costEstimate: session?.costEstimate ?? null,
    diffShortstat,
  };
}
