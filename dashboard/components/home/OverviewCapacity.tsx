"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Settings } from "@/lib/settings";
import type { EvalRow } from "@/lib/evals/store";

interface Props {
  settings: Settings | null;
  activeCount: number;
}

function gradeColor(grade: string): string {
  const g = grade[0]?.toUpperCase();
  if (g === "A" || g === "B") return "bg-ok-bg text-ok";
  if (g === "C") return "bg-warn-bg text-warn";
  return "bg-danger-bg text-danger";
}

export function OverviewCapacity({ settings, activeCount }: Props) {
  const [grades, setGrades] = useState<EvalRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/evals", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        const rows: EvalRow[] = (data.evals ?? [])
          .filter((e: EvalRow) => e.grade)
          .sort((a: EvalRow, b: EvalRow) => b.gradedAt - a.gradedAt)
          .slice(0, 6);
        setGrades(rows);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const globalMax = settings?.concurrency.globalMax ?? null;
  const pct = globalMax ? Math.min(100, Math.round((activeCount / globalMax) * 100)) : 0;

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3">Capacity · grades</h2>
        <Link href="/evals" className="text-xs text-accent hover:underline">evals →</Link>
      </div>

      <div className="mb-3">
        <div className="flex items-baseline justify-between text-xs mb-1">
          <span className="text-ink3">Active runs</span>
          <span className="tabular-nums">
            {activeCount}
            {globalMax !== null ? ` / ${globalMax}` : ""}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: pct >= 100 ? "var(--danger)" : "linear-gradient(90deg,#4a8fd1,#7fb4e8)",
            }}
          />
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-ink3 mb-1">Latest grades</div>
        {grades === null ? (
          <p className="text-xs text-ink3">Loading…</p>
        ) : grades.length === 0 ? (
          <p className="text-xs text-ink3">No graded runs yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {grades.map((g) => (
              <span
                key={g.runId ?? g.gradedAt}
                title={`run #${g.runId ?? "?"} · score ${g.score ?? "?"}`}
                className={"text-[10px] font-medium px-1.5 py-0.5 rounded " + gradeColor(g.grade ?? "")}
              >
                {g.grade}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
