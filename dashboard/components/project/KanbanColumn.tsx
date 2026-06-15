"use client";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import { StatusDot } from "@/components/common/StatusDot";
import { IssueCard } from "./IssueCard";
import type { IssueSummary } from "@/hooks/useIssues";
import type { AgentDisplay } from "./KanbanBoard";

interface Props {
  status: IssueSummary["status"];
  title: string;
  issues: IssueSummary[];
  onOpenIssue: (id: number) => void;
  showProject?: boolean;
  agents?: AgentDisplay[];
}

// Status-dot tone per column, matching the v2 cosmic palette.
const STATUS_TONE: Record<string, "ok" | "accent" | "warn" | "neutral"> = {
  backlog: "neutral",
  queued: "accent",
  running: "ok",
  review: "warn",
  done: "neutral",
};

export function KanbanColumn({ status, title, issues, onOpenIssue, showProject, agents }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex flex-col rounded-card border border-line bg-surface2 p-2.5 min-h-[300px] transition-shadow",
        isOver && "ring-2 ring-accent-line"
      )}
    >
      <header className="flex items-center gap-2 px-1 py-1 mb-2.5">
        <StatusDot tone={STATUS_TONE[status] ?? "neutral"} pulse={status === "running"} />
        <h3 className="font-label uppercase tracking-wide text-[11px] text-ink2">{title}</h3>
        <span className="ml-auto font-label text-[11px] text-ink3">{issues.length}</span>
      </header>
      <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2.5 flex-1">
          {issues.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onOpen={onOpenIssue}
              showProject={showProject}
              agents={agents}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
