"use client";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
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

export function KanbanColumn({ status, title, issues, onOpenIssue, showProject, agents }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex flex-col rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-2 min-h-[300px]",
        isOver && "ring-2 ring-blue-400"
      )}
    >
      <header className="flex items-center justify-between px-1 py-1 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        <span className="text-xs text-gray-400">{issues.length}</span>
      </header>
      <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
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
