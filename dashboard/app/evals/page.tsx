"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";
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
  parentIssueId: number | null;
  metricsJson: string | null;
  score: number | null;
  grade: string | null;
  rubricJson: string | null;
  judgeProvider: string | null;
}

// Grade-chip tone matches OverviewCapacity: A/B → ok, C → warn, else danger.
function gradeColor(grade: string): string {
  const g = grade[0]?.toUpperCase();
  if (g === "A" || g === "B") return "bg-ok-bg text-ok";
  if (g === "C") return "bg-warn-bg text-warn";
  return "bg-danger-bg text-danger";
}

// Behavioral validator results (spec 0032 / ADR-025) ride along on the persisted
// rubric only when the harness ran. The page reads them read-only; the shape
// mirrors `BehavioralResult` in @/lib/evals/behavioral.
interface BehavioralEntry {
  assertion: string;
  status: "pass" | "fail" | "inconclusive";
  reason: string;
  screenshotPath?: string;
}

interface ParsedRubric {
  rationale?: unknown;
  behavioral?: BehavioralEntry[];
}

const BEHAVIORAL_COLORS: Record<BehavioralEntry["status"], string> = {
  pass: "bg-ok-bg text-ok",
  fail: "bg-danger-bg text-danger",
  inconclusive: "bg-warn-bg text-warn",
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
    if (event.kind === "eval.completed" || event.kind === "revision.filed" || event.kind === "revision.escalated") {
      void load();
    }
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
      <SectionHeader
        kicker="JUDGE"
        title="Evals"
        description="Deterministic run metrics plus optional LLM-judged rubric scores (subjective; one CLI call per grade)."
        action={
          <Button variant="primary" onClick={() => grade("batch")} disabled={busy !== null}>
            {busy === "batch" ? "Grading batch..." : "Grade ungraded runs"}
          </Button>
        }
      />
      {error && <p className="text-sm text-danger mb-6">{error}</p>}

      {!rows && !error && <p className="text-sm text-ink3">Loading evals...</p>}
      {rows && rows.length === 0 && (
        <EmptyState title="No finished runs" description="Run grades appear here after agent runs complete." />
      )}

      {graded.length > 0 && (
        <section className="mb-6 max-w-md">
          <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-2">Grade distribution</h2>
          <Bars labels={["A", "B", "C", "D", "F"]} series={[{ label: "runs", values: distribution, fill: "var(--accent)" }]} height={100} />
        </section>
      )}

      {rows && rows.length > 0 && (
        <div className="rounded-card border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-line font-label uppercase tracking-wide text-[10px] text-ink3">
              <th className="py-2 px-3">Run</th>
              <th className="py-2 px-3">Issue</th>
              <th className="py-2 px-3">Agent</th>
              <th className="py-2 px-3">Exit</th>
              <th className="py-2 px-3">Metrics</th>
              <th className="py-2 px-3">Grade</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const metrics = r.metricsJson ? (JSON.parse(r.metricsJson) as Record<string, unknown>) : null;
              const rubric = r.rubricJson ? (JSON.parse(r.rubricJson) as ParsedRubric) : null;
              const behavioral = rubric?.behavioral?.length ? rubric.behavioral : null;
              return (
                <Fragment key={r.runId}>
                <tr className="border-b border-line align-top transition-colors hover:bg-surface2">
                  <td className="py-2 px-3 font-mono text-ink2">{r.runId}</td>
                  <td className="py-2 px-3 max-w-64 truncate" title={r.issueTitle}>
                    {r.parentIssueId != null && (
                      <span
                        className="mr-1 rounded-pill bg-accent-bg px-1.5 py-0.5 text-[10px] font-medium text-accent-ink"
                        title={`Revision of issue ${r.parentIssueId}`}
                      >
                        ↻ rev of #{r.parentIssueId}
                      </span>
                    )}
                    {r.projectSlug}: {r.issueTitle}
                  </td>
                  <td className="py-2 px-3">
                    {r.agentSlug} <span className="text-ink3">({r.runtimeId})</span>
                  </td>
                  <td className="py-2 px-3">{r.exitStatus}</td>
                  <td className="py-2 px-3 text-xs text-ink3">
                    {metrics
                      ? `${metrics.durationMs != null ? `${Math.round((metrics.durationMs as number) / 1000)}s` : "?"} · ${
                          metrics.toolCalls ?? "?"
                        } tools · ${metrics.tokensOut ?? "n/a"} out`
                      : "-"}
                  </td>
                  <td className="py-2 px-3">
                    {r.grade ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium ${gradeColor(r.grade)}`}
                        title={rubric ? String(rubric.rationale ?? "") : undefined}
                      >
                        {r.grade}{" "}
                        {r.score != null ? <span className="font-mono">({Math.round(r.score)})</span> : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-ink3">ungraded</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Button onClick={() => grade(r.runId)} disabled={busy !== null}>
                      {busy === r.runId ? "Grading..." : r.grade ? "Re-grade" : "Grade"}
                    </Button>
                  </td>
                </tr>
                {behavioral && (
                  <tr className="border-b border-line">
                    <td className="pb-2 px-3 text-xs text-ink3" colSpan={7}>
                      <span className="mr-2 font-medium">Behavioral checks</span>
                      <span className="inline-flex flex-wrap gap-1.5 align-middle">
                        {behavioral.map((b, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium ${BEHAVIORAL_COLORS[b.status]}`}
                            title={`${b.assertion}: ${b.reason}`}
                          >
                            {b.status} · {b.assertion}
                            {b.screenshotPath && (
                              <a
                                href={`file://${b.screenshotPath}`}
                                className="underline"
                                title={b.screenshotPath}
                                onClick={(e) => e.stopPropagation()}
                              >
                                shot
                              </a>
                            )}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </main>
  );
}
