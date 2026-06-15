"use client";
import Link from "next/link";
import { Card } from "@/components/common/Card";
import { StatusDot } from "@/components/common/StatusDot";
import { RuntimeBadge } from "@/components/common/RuntimeBadge";
import { elapsed } from "@/lib/timeAgo";
import type { RunWithIssue } from "@/lib/runs";

function initials(slug: string): string {
  return slug
    .split("-")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ActiveRunsCard({ runs }: { runs: RunWithIssue[] }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-label text-[11px] uppercase tracking-[0.16em] text-ink2">Active runs</h2>
        <Link href="/activity" className="text-xs text-accent-ink hover:underline">
          All activity →
        </Link>
      </div>
      {runs.length === 0 ? (
        <p className="text-sm text-ink3">Nothing running. Start a run from a project board.</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-md border border-line border-l-2 border-l-accent bg-surface2 px-3 py-2.5 text-sm"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-bg font-label text-xs text-accent-ink">
                {initials(r.agentSlug)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink">{r.issueTitle}</p>
                <p className="truncate text-xs text-ink3">
                  {r.agentSlug} ·{" "}
                  <Link href={`/projects/${r.projectSlug}`} className="hover:text-accent">
                    {r.projectSlug}
                  </Link>
                  {r.model && <span className="font-mono"> · {r.model}</span>}
                </p>
              </div>
              <RuntimeBadge runtimeId={r.runtimeId} />
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink3">
                <StatusDot tone="ok" pulse />
                {elapsed(r.startedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
