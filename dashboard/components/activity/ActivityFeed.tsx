import Link from "next/link";
import { Card } from "@/components/common/Card";
import { Pill } from "@/components/common/Pill";
import { StatusDot } from "@/components/common/StatusDot";
import { RuntimeBadge } from "@/components/common/RuntimeBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { timeAgo } from "@/lib/timeAgo";
import type { RunWithIssue } from "@/lib/runs";

function statusPill(r: RunWithIssue) {
  if (r.endedAt == null) {
    return (
      <Pill tone="accent">
        <StatusDot tone="accent" pulse /> running
      </Pill>
    );
  }
  if (r.exitStatus === "done") return <Pill tone="ok">done</Pill>;
  return <Pill tone="danger">{r.exitStatus ?? "failed"}</Pill>;
}

export function ActivityFeed({ runs }: { runs: RunWithIssue[] }) {
  if (runs.length === 0) {
    return <EmptyState title="No runs yet" description="Start a run from a project board and it shows up here." />;
  }
  return (
    <Card>
      <ul className="divide-y divide-line">
        {runs.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
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
            {statusPill(r)}
            <span className="text-xs text-ink3 w-16 text-right shrink-0">
              {timeAgo(r.endedAt ?? r.startedAt)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
