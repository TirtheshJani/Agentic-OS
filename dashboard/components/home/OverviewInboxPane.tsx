"use client";
import Link from "next/link";
import type { IssueSummary } from "@/hooks/useIssues";
import type { RunWithIssue } from "@/lib/runs";
import { EmptyState } from "@/components/common/EmptyState";

interface Props {
  issues: IssueSummary[] | null;
  recentRuns: RunWithIssue[];
}

// ADR-020: a run interrupted by a restart moves its issue to `review`. We flag
// those so the operator can tell an environment interruption from a clean
// finished-for-review issue. Derived client-side from recent runs; the full
// detail lives in /inbox.
export function OverviewInboxPane({ issues, recentRuns }: Props) {
  const interruptedIssueIds = new Set(
    recentRuns.filter((r) => r.exitStatus === "interrupted").map((r) => r.issueId)
  );
  const review = (issues ?? []).filter((i) => i.status === "review");

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3">
          Inbox · review ({review.length})
        </h2>
        <Link href="/inbox" className="text-xs text-accent hover:underline">inbox →</Link>
      </div>
      {review.length === 0 ? (
        <EmptyState title="Inbox clear" description="Issues awaiting review will collect here." />
      ) : (
        <ul className="space-y-1 text-xs">
          {review.slice(0, 6).map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <span className="truncate">{i.title}</span>
              {interruptedIssueIds.has(i.id) && (
                <span className="shrink-0 rounded-full bg-warn-bg px-1.5 py-0.5 font-label text-[9px] uppercase tracking-wide text-warn">
                  interrupted
                </span>
              )}
              <span className="text-ink3 ml-auto shrink-0">{i.projectSlug}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
