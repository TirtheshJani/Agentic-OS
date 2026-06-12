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
      <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-3">Active runs</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-ink3">Nothing running. Start a run from a project board.</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 text-sm">
              <span className="w-8 h-8 rounded-full bg-accent-bg text-accent-ink flex items-center justify-center text-xs font-medium shrink-0">
                {initials(r.agentSlug)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink">{r.issueTitle}</p>
                <p className="text-xs text-ink3 truncate">
                  {r.agentSlug} ·{" "}
                  <Link href={`/projects/${r.projectSlug}`} className="hover:text-accent">
                    {r.projectSlug}
                  </Link>
                  {r.model && <span className="font-mono"> · {r.model}</span>}
                </p>
              </div>
              <RuntimeBadge runtimeId={r.runtimeId} />
              <span className="flex items-center gap-1.5 text-xs text-ink3 shrink-0">
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
