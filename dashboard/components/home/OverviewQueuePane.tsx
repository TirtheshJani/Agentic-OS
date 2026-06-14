"use client";
import Link from "next/link";
import type { IssueSummary } from "@/hooks/useIssues";
import { EmptyState } from "@/components/common/EmptyState";

const COLUMNS: { status: IssueSummary["status"]; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "queued", label: "Queued" },
  { status: "running", label: "Running" },
  { status: "review", label: "Review" },
];

interface Props {
  issues: IssueSummary[] | null;
}

export function OverviewQueuePane({ issues }: Props) {
  const counts = COLUMNS.map((c) => ({
    ...c,
    n: issues ? issues.filter((i) => i.status === c.status).length : 0,
  }));
  // A few highest-priority queued/running items to preview under the counters.
  const preview = (issues ?? [])
    .filter((i) => i.status === "queued" || i.status === "running")
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4);

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3">Queue</h2>
        <Link href="/issues" className="text-xs text-accent hover:underline">board →</Link>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {counts.map((c) => (
          <div key={c.status} className="rounded border border-line2 px-2 py-1.5 text-center">
            <div className="text-lg font-medium tabular-nums">{c.n}</div>
            <div className="text-[10px] uppercase tracking-wide text-ink3">{c.label}</div>
          </div>
        ))}
      </div>
      {preview.length === 0 ? (
        <EmptyState title="Nothing in flight" description="Queued and running issues will preview here." />
      ) : (
        <ul className="space-y-1 text-xs">
          {preview.map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <span
                className={
                  "inline-block h-1.5 w-1.5 shrink-0 rounded-full " +
                  (i.status === "running" ? "bg-ok" : "bg-warn")
                }
              />
              <span className="truncate">{i.title}</span>
              <span className="text-ink3 ml-auto shrink-0">{i.projectSlug}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
