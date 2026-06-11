"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { Bars } from "@/components/charts/Bars";
import { useStream } from "@/hooks/useStream";

interface EvalRow {
  runId: number;
  agentSlug: string;
  runtimeId: string;
  exitStatus: string | null;
  issueId: number;
  issueTitle: string;
  projectSlug: string;
  metricsJson: string | null;
  score: number | null;
  grade: string | null;
  rubricJson: string | null;
  judgeProvider: string | null;
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  B: "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300",
  C: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  D: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  F: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function EvalsPage() {
  const [rows, setRows] = useState<EvalRow[] | null>(null);
  const [busy, setBusy] = useState<number | "batch" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/evals", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows(((await res.json()) as { evals: EvalRow[] }).evals);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useStream((event) => {
    if (event.kind === "eval.completed") void load();
  });

  async function grade(runId: number | "batch") {
    setBusy(runId);
    setError(null);
    try {
      const res = await fetch("/api/evals/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runId === "batch" ? { batch: true } : { runId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const graded = (rows ?? []).filter((r) => r.grade);
  const distribution = ["A", "B", "C", "D", "F"].map((g) => graded.filter((r) => r.grade === g).length);

  return (
    <main className="max-w-7xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-1">Evals</h1>
      <p className="text-sm text-ink3 mb-4">
        Deterministic run metrics plus optional LLM-judged rubric scores (subjective; one CLI call per grade).
      </p>
      <div className="flex items-center gap-3 mb-6">
        <Button onClick={() => grade("batch")} disabled={busy !== null}>
          {busy === "batch" ? "Grading batch..." : "Grade ungraded runs"}
        </Button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      {!rows && !error && <p className="text-sm text-ink3">Loading evals...</p>}
      {rows && rows.length === 0 && (
        <EmptyState title="No finished runs" description="Run grades appear here after agent runs complete." />
      )}

      {graded.length > 0 && (
        <section className="mb-6 max-w-md">
          <h2 className="text-sm font-semibold mb-2">Grade distribution</h2>
          <Bars labels={["A", "B", "C", "D", "F"]} series={[{ label: "runs", values: distribution, fill: "rgb(59 130 246)" }]} height={100} />
        </section>
      )}

      {rows && rows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink3 border-b border-line">
              <th className="py-1.5 pr-2">Run</th>
              <th className="py-1.5 pr-2">Issue</th>
              <th className="py-1.5 pr-2">Agent</th>
              <th className="py-1.5 pr-2">Exit</th>
              <th className="py-1.5 pr-2">Metrics</th>
              <th className="py-1.5 pr-2">Grade</th>
              <th className="py-1.5 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const metrics = r.metricsJson ? (JSON.parse(r.metricsJson) as Record<string, unknown>) : null;
              const rubric = r.rubricJson ? (JSON.parse(r.rubricJson) as Record<string, unknown>) : null;
              return (
                <tr key={r.runId} className="border-b border-line align-top">
                  <td className="py-1.5 pr-2">{r.runId}</td>
                  <td className="py-1.5 pr-2 max-w-64 truncate" title={r.issueTitle}>
                    {r.projectSlug}: {r.issueTitle}
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.agentSlug} <span className="text-ink3">({r.runtimeId})</span>
                  </td>
                  <td className="py-1.5 pr-2">{r.exitStatus}</td>
                  <td className="py-1.5 pr-2 text-xs text-ink3">
                    {metrics
                      ? `${metrics.durationMs != null ? `${Math.round((metrics.durationMs as number) / 1000)}s` : "?"} · ${
                          metrics.toolCalls ?? "?"
                        } tools · ${metrics.tokensOut ?? "n/a"} out`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.grade ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${GRADE_COLORS[r.grade] ?? ""}`}
                        title={rubric ? String(rubric.rationale ?? "") : undefined}
                      >
                        {r.grade} {r.score != null ? `(${Math.round(r.score)})` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-ink3">ungraded</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Button onClick={() => grade(r.runId)} disabled={busy !== null}>
                      {busy === r.runId ? "Grading..." : r.grade ? "Re-grade" : "Grade"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
