"use client";
import { useEffect, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useActivity } from "@/hooks/useActivity";
import { useIssues } from "@/hooks/useIssues";
import { useSettings } from "@/hooks/useSettings";
import { ProjectCard } from "@/components/home/ProjectCard";
import { ActiveRunsCard } from "@/components/home/ActiveRunsCard";
import { OverviewQueuePane } from "@/components/home/OverviewQueuePane";
import { OverviewInboxPane } from "@/components/home/OverviewInboxPane";
import { OverviewCapacity } from "@/components/home/OverviewCapacity";
import { OverviewEventStream } from "@/components/home/OverviewEventStream";
import { StatCard } from "@/components/common/StatCard";
import { SectionHeader } from "@/components/common/SectionHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { NewProjectDialog } from "@/components/home/NewProjectDialog";

interface Counts {
  agents: number | null;
  skills: number | null;
}

export default function Home() {
  const { projects, error } = useProjects();
  const { data: activity } = useActivity();
  const { issues } = useIssues();
  const { settings } = useSettings();
  const [dialogMode, setDialogMode] = useState<null | "link" | "clone">(null);
  const [counts, setCounts] = useState<Counts>({ agents: null, skills: null });

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/agents", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/skills", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([agents, skills]) => {
        if (!alive) return;
        setCounts({
          agents: agents ? agents.agents.length : null,
          skills: skills ? skills.skills.length : null,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const openIssues = issues ? issues.filter((i) => i.status !== "done").length : null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <SectionHeader
        kicker="Ad astra per aspera"
        size="lg"
        title="Command Center"
        description="Delegate recurring work to agents; watch it run."
        action={
          <div className="relative">
            <details className="group">
              <summary className="list-none cursor-pointer rounded-pill bg-accent px-4 py-1.5 text-sm font-medium text-white shadow-glow">
                + New Project
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-56 rounded-card border border-line bg-surface shadow-card">
                <button
                  onClick={() => setDialogMode("clone")}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-surface2"
                >
                  Clone from GitHub
                </button>
                <button
                  onClick={() => setDialogMode("link")}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-surface2"
                >
                  Link existing folder
                </button>
              </div>
            </details>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Active runs" value={activity ? activity.active.length : "–"} />
        <StatCard label="Open issues" value={openIssues ?? "–"} />
        <StatCard label="Agents" value={counts.agents ?? "–"} />
        <StatCard label="Skills" value={counts.skills ?? "–"} />
      </div>

      {/* Top strip: running sessions */}
      <div className="mb-3">
        <ActiveRunsCard runs={activity?.active ?? []} />
      </div>

      {/* HUD: queue + capacity | inbox | live event stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <div className="space-y-3 min-w-0">
          <OverviewQueuePane issues={issues} />
          <OverviewCapacity settings={settings} activeCount={activity?.active.length ?? 0} />
        </div>
        <div className="min-w-0">
          <OverviewInboxPane issues={issues} recentRuns={activity?.recent ?? []} />
        </div>
        <div className="min-w-0">
          <OverviewEventStream />
        </div>
      </div>

      <section>
        <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-3">Projects</h2>
        {error && <div className="text-sm text-danger">Error: {error}</div>}
        {!projects ? (
          <p className="text-sm text-ink3">Loading...</p>
        ) : projects.length === 0 ? (
          <EmptyState title="No projects yet" description='Click "+ New Project" to get started.' />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.slug}
                slug={p.slug}
                name={p.name}
                path={p.path}
                repo={p.repo}
                crew={p.crew}
                capabilities={p.capabilities}
                lastModified={p.lastModified}
              />
            ))}
          </div>
        )}
      </section>

      {dialogMode && <NewProjectDialog mode={dialogMode} onClose={() => setDialogMode(null)} />}
    </div>
  );
}
