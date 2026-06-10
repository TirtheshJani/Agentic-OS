"use client";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { useIssues, type IssueSummary } from "@/hooks/useIssues";

const COLUMNS: Array<{ status: IssueSummary["status"]; title: string }> = [
  { status: "backlog", title: "Backlog" },
  { status: "queued", title: "Queued" },
  { status: "running", title: "Running" },
  { status: "review", title: "Review" },
  { status: "done", title: "Done" },
];

export interface AgentDisplay {
  slug: string;
  name: string;
}

interface Props {
  /** Omit for the global cross-project board. */
  projectSlug?: string;
  onOpenIssue: (id: number) => void;
  /** When provided, cards render a quick-assign select with these agents. */
  agents?: AgentDisplay[];
}

export function KanbanBoard({ projectSlug, onOpenIssue, agents }: Props) {
  const { issues, reload } = useIssues(projectSlug);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const showProject = projectSlug == null;

  async function onDragEnd(event: DragEndEvent) {
    const issueId = event.active.id as number;
    const overId = event.over?.id;
    if (typeof overId !== "string" || !overId.startsWith("col:")) return;
    const newStatus = overId.slice(4) as IssueSummary["status"];
    const issue = issues?.find(i => i.id === issueId);
    if (!issue || issue.status === newStatus) return;

    // Optimistic UI: trigger reload after server confirms.
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      console.error("Failed to update status");
    }
    // SSE will trigger reload, but call it directly as a fallback.
    reload();
  }

  if (!issues) return <p className="text-sm text-gray-400 p-4">Loading issues...</p>;

  const byStatus: Record<string, IssueSummary[]> = {};
  for (const col of COLUMNS) byStatus[col.status] = [];
  for (const i of issues) {
    if (byStatus[i.status]) byStatus[i.status].push(i);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-5 gap-3">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            title={col.title}
            issues={byStatus[col.status]}
            onOpenIssue={onOpenIssue}
            showProject={showProject}
            agents={agents}
          />
        ))}
      </div>
    </DndContext>
  );
}
