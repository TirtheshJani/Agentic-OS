"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Pill } from "@/components/common/Pill";
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

// Priority → label + accent color (matches the v2 cosmic palette).
const PRIORITY: Record<number, { label: string; className: string }> = {
  3: { label: "P3", className: "text-ink3" },
  2: { label: "URGENT", className: "text-danger" },
  1: { label: "HIGH", className: "text-warn" },
};

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

  const isRunning = issue.status === "running";
  const priority = PRIORITY[issue.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3 cursor-grab active:cursor-grabbing text-sm shadow-card transition-colors hover:border-accent-line",
        isRunning && "border-l-2 border-l-accent",
        isDragging && "shadow-card-lg"
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
      <div className="flex items-center gap-2">
        <span className="font-label text-[10px] text-ink3">#{issue.id}</span>
        <Pill tone={issue.mode === "sync" ? "warn" : "neutral"}>{issue.mode}</Pill>
        {priority && (
          <span className={clsx("ml-auto font-label text-[9px] uppercase tracking-wide", priority.className)}>
            {priority.label}
          </span>
        )}
      </div>

      <h3 className="font-medium leading-snug text-ink">{issue.title}</h3>

      {showProject && (
        <span className="inline-flex w-fit rounded-pill bg-accent-bg px-2 py-0.5 font-label text-[10px] uppercase tracking-wide text-accent-ink">
          {issue.projectSlug}
        </span>
      )}

      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {issue.labels.map((l) => (
            <span key={l} className="rounded-md bg-surface2 px-1.5 py-0.5 font-mono text-[9px] text-ink3">
              {l}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-line pt-2 text-xs text-ink3">
        {agents && agents.length > 0 ? (
          <select
            value={issue.assigneeSlug ?? ""}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); assign(e.target.value); }}
            className="ml-auto max-w-[120px] rounded-md border border-line2 bg-surface2 px-1.5 py-0.5 text-xs text-ink2"
            title="Assign agent"
          >
            <option value="">unassigned</option>
            {agents.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        ) : (
          <span className="ml-auto truncate font-mono text-[11px]">{issue.assigneeSlug ?? "unassigned"}</span>
        )}
      </div>
    </div>
  );
}
