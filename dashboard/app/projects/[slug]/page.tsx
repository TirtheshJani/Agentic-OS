"use client";
import { use, useEffect, useState, useCallback } from "react";
import { notFound } from "next/navigation";
import { useStream } from "@/hooks/useStream";
import { ProjectHeader } from "@/components/project/ProjectHeader";
import { CrewSidebar } from "@/components/project/CrewSidebar";
import { KanbanBoard } from "@/components/project/KanbanBoard";
import { NewIssueDialog } from "@/components/project/NewIssueDialog";
import { CrewPickerDrawer } from "@/components/project/CrewPickerDrawer";
import { IssueDrawer } from "@/components/issue/IssueDrawer";
import { WorktreeList } from "@/components/project/WorktreeList";
import { ProjectTabs } from "@/components/project/ProjectTabs";
import { KnowledgeTab } from "@/components/project/KnowledgeTab";

interface ProjectData {
  slug: string;
  name: string;
  path: string;
  repo: string | null;
  crew: string[];
  capabilities: string[];
  runtimeDefault: string;
}

interface AgentDetail {
  slug: string;
  name: string;
  skills: string[];
}

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [agents, setAgents] = useState<AgentDetail[] | null>(null);
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  const reloadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}`, { cache: "no-store" });
    if (res.status === 404) {
      setNotFoundFlag(true);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setProject(data);
  }, [slug]);

  const reloadAgents = useCallback(async () => {
    const res = await fetch("/api/agents", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setAgents(data.agents);
  }, []);

  useEffect(() => {
    reloadProject();
    reloadAgents();
  }, [reloadProject, reloadAgents]);

  useStream((event) => {
    if (event.kind === "project.changed" && (event as any).slug === slug) reloadProject();
    if (event.kind === "agent.changed") reloadAgents();
  });

  if (notFoundFlag) notFound();
  if (!project || !agents) return <p className="p-6 text-sm text-gray-500">Loading...</p>;

  const crewDisplay: AgentDetail[] = project.crew
    .map(s => agents.find(a => a.slug === s))
    .filter((a): a is AgentDetail => Boolean(a));

  return (
    <main className="max-w-7xl mx-auto p-6">
      <ProjectHeader
        name={project.name}
        slug={project.slug}
        path={project.path}
        repo={project.repo}
        runtimeDefault={project.runtimeDefault}
        onNewIssue={() => setShowNewIssue(true)}
      />
      <ProjectTabs
        board={
          <>
            <div className="grid grid-cols-[1fr_280px] gap-6">
              <KanbanBoard projectSlug={slug} onOpenIssue={setOpenIssueId} />
              <CrewSidebar crew={crewDisplay} onEditCrew={() => setShowCrewPicker(true)} />
            </div>

            <WorktreeList projectSlug={slug} />
          </>
        }
        knowledge={<KnowledgeTab projectSlug={slug} />}
      />

      {showNewIssue && (
        <NewIssueDialog
          projectSlug={slug}
          crew={crewDisplay}
          onClose={() => setShowNewIssue(false)}
        />
      )}
      {showCrewPicker && (
        <CrewPickerDrawer
          projectSlug={slug}
          projectCapabilities={project.capabilities}
          currentCrew={project.crew}
          allAgents={agents}
          onClose={() => setShowCrewPicker(false)}
        />
      )}
      {openIssueId !== null && (
        <IssueDrawer
          issueId={openIssueId}
          crew={crewDisplay}
          onClose={() => setOpenIssueId(null)}
        />
      )}
    </main>
  );
}
