"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusDot } from "@/components/ui/status-dot";

type Run = {
  id: number;
  skill_slug: string;
  status: "queued" | "running" | "done" | "error";
  started_at: number;
  duration_ms: number | null;
  project_slug: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
};

export function RecentRunsCard() {
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        const j = await res.json();
        if (!cancelled) setRuns(j.runs ?? []);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="RECENT RUNS" />
      {runs.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">No runs yet.</div>
      )}
      <ul className="space-y-0.5 mt-1">
        {runs.map((r) => {
          const tokens =
            r.tokens_in !== null && r.tokens_out !== null
              ? `${r.tokens_in}/${r.tokens_out}`
              : null;
          return (
            <li key={r.id} className="flex items-center gap-2 font-mono text-xs">
              <StatusDot state={dotFor(r.status)} />
              <span className="text-muted-foreground">{hhmm(r.started_at)}</span>
              {r.project_slug && (
                <span className="text-[var(--azure)] shrink-0">◆ {r.project_slug}</span>
              )}
              <span className="truncate">{r.skill_slug}</span>
              {tokens && (
                <span className="text-muted-foreground ml-auto shrink-0">{tokens}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function dotFor(s: Run["status"]): "idle" | "running" | "blocked" {
  if (s === "running") return "running";
  if (s === "error") return "blocked";
  return "idle";
}

function hhmm(ts: number): string {
  const d = new Date(ts);
  const h = `${d.getHours()}`.padStart(2, "0");
  const m = `${d.getMinutes()}`.padStart(2, "0");
  return `${h}:${m}`;
}
