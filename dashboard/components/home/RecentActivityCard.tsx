"use client";
import { Card } from "@/components/common/Card";
import { Pill } from "@/components/common/Pill";
import { timeAgo } from "@/lib/timeAgo";
import type { RunWithIssue } from "@/lib/runs";

function tone(exitStatus: string | null): "ok" | "danger" | "accent" {
  if (exitStatus === "done") return "ok";
  if (exitStatus === "failed") return "danger";
  return "accent";
}

export function RecentActivityCard({ runs }: { runs: RunWithIssue[] }) {
  const finished = runs.filter((r) => r.endedAt != null).slice(0, 8);
  return (
    <Card className="p-4">
      <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-3">Recent activity</h2>
      {finished.length === 0 ? (
        <p className="text-sm text-ink3">No finished runs yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {finished.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-1.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink">{r.issueTitle}</p>
                <p className="text-xs text-ink3 truncate">
                  {r.agentSlug} · {r.projectSlug}
                </p>
              </div>
              <Pill tone={tone(r.exitStatus)}>{r.exitStatus ?? "running"}</Pill>
              <span className="text-xs text-ink3 shrink-0 w-16 text-right">{timeAgo(r.endedAt!)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
