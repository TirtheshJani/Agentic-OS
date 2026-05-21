"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { IssueSummary } from "@/hooks/useIssues";

interface Props {
  issue: IssueSummary;
  onOpen: (id: number) => void;
}

export function IssueCard({ issue, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 cursor-grab active:cursor-grabbing text-sm",
        isDragging && "shadow-lg"
      )}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only treat as click if not a drag.
        if (!isDragging) {
          e.stopPropagation();
          onOpen(issue.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{issue.title}</h3>
        {issue.priority > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 shrink-0">
            P{issue.priority}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{issue.assigneeSlug ?? "unassigned"}</span>
        <span>{issue.mode}</span>
      </div>
      {issue.labels.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {issue.labels.map(l => (
            <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
