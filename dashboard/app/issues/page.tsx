"use client";
import { useCallback, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/project/KanbanBoard";
import { IssueDrawer } from "@/components/issue/IssueDrawer";
import { NewIssueDialog } from "@/components/project/NewIssueDialog";
import { Button } from "@/components/common/Button";
import { useProjects } from "@/hooks/useProjects";
import { useStream } from "@/hooks/useStream";

interface AgentDetail {
  slug: string;
  name: string;
  skills: string[];
}

export default function IssuesPage() {
  const { projects } = useProjects();
  const [agents, setAgents] = useState<AgentDetail[] | null>(null);
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);
  const [newIssueProject, setNewIssueProject] = useState("");
  const [showNewIssue, setShowNewIssue] = useState(false);

  const reloadAgents = useCallback(async () => {
    const res = await fetch("/api/agents", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setAgents(data.agents);
  }, []);

  useEffect(() => {
    reloadAgents();
  }, [reloadAgents]);

  useStream((event) => {
    if (event.kind === "agent.changed") reloadAgents();
  });

  useEffect(() => {
    if (projects && projects.length > 0 && !newIssueProject) {
      setNewIssueProject(projects[0].slug);
    }
  }, [projects, newIssueProject]);

  return (
    <main className="max-w-7xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Issues</h1>
        <div className="flex items-center gap-2">
          {projects && projects.length > 0 && (
            <select
              value={newIssueProject}
              onChange={(e) => setNewIssueProject(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm"
              title="Project for the new issue"
            >
              {projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
          )}
          <Button
            variant="primary"
            onClick={() => setShowNewIssue(true)}
            disabled={!newIssueProject}
          >
            + New Issue
          </Button>
        </div>
      </header>

      <KanbanBoard onOpenIssue={setOpenIssueId} agents={agents ?? []} />

      {showNewIssue && newIssueProject && (
        <NewIssueDialog
          projectSlug={newIssueProject}
          crew={agents ?? []}
          onClose={() => setShowNewIssue(false)}
        />
      )}
      {openIssueId !== null && (
        <IssueDrawer
          issueId={openIssueId}
          crew={agents ?? []}
          onClose={() => setOpenIssueId(null)}
        />
      )}
    </main>
  );
}
