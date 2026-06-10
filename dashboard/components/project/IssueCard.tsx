"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { IssueSummary } from "@/hooks/useIssues";
import type { AgentDisplay } from "./KanbanBoard";

interface Props {
  issue: IssueSummary;
  onOpen: (id: number) => void;
  /** Render the project slug chip (global board). */
  showProject?: boolean;
  /** When provided, the assignee renders as a quick-assign select. */
  agents?: AgentDisplay[];
}

export function IssueCard({ issue, onOpen, showProject, agents }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  async function assign(slug: string) {
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeSlug: slug || null }),
    });
    // SSE issue.changed triggers the board reload.
  }

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
      {showProject && (
        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200">
          {issue.projectSlug}
        </span>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        {agents && agents.length > 0 ? (
          <select
            value={issue.assigneeSlug ?? ""}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); assign(e.target.value); }}
            className="text-xs max-w-[140px] rounded border border-gray-200 dark:border-gray-800 bg-transparent px-1 py-0.5"
            title="Assign agent"
          >
            <option value="">unassigned</option>
            {agents.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        ) : (
          <span>{issue.assigneeSlug ?? "unassigned"}</span>
        )}
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
