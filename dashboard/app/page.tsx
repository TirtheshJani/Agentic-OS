"use client";
import { useEffect, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useActivity } from "@/hooks/useActivity";
import { ProjectCard } from "@/components/home/ProjectCard";
import { ActiveRunsCard } from "@/components/home/ActiveRunsCard";
import { RecentActivityCard } from "@/components/home/RecentActivityCard";
import { TodayPanel } from "@/components/home/TodayPanel";
import { StatCard } from "@/components/common/StatCard";
import { SectionHeader } from "@/components/common/SectionHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { NewProjectDialog } from "@/components/home/NewProjectDialog";

interface Counts {
  agents: number | null;
  skills: number | null;
  openIssues: number | null;
}

export default function Home() {
  const { projects, error } = useProjects();
  const { data: activity } = useActivity();
  const [dialogMode, setDialogMode] = useState<null | "link" | "clone">(null);
  const [counts, setCounts] = useState<Counts>({ agents: null, skills: null, openIssues: null });

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/agents", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/skills", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/issues", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([agents, skills, issues]) => {
        if (!alive) return;
        setCounts({
          agents: agents ? agents.agents.length : null,
          skills: skills ? skills.skills.length : null,
          openIssues: issues
            ? issues.issues.filter((i: { status: string }) => i.status !== "done").length
            : null,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <SectionHeader
        title="Command Center"
        description="Delegate recurring work to agents; watch it run."
        action={
          <div className="relative">
            <details className="group">
              <summary className="list-none cursor-pointer text-sm px-3 py-1.5 rounded-md border border-line2 hover:border-accent-line">
                + New Project
              </summary>
              <div className="absolute right-0 mt-1 w-56 rounded-md border border-line bg-surface shadow-card z-10">
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
        <StatCard label="Open issues" value={counts.openIssues ?? "–"} />
        <StatCard label="Agents" value={counts.agents ?? "–"} />
        <StatCard label="Skills" value={counts.skills ?? "–"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 mb-6">
        <div className="space-y-3 min-w-0">
          <ActiveRunsCard runs={activity?.active ?? []} />
          <RecentActivityCard runs={activity?.recent ?? []} />
        </div>
        <TodayPanel activeRunCount={activity?.active.length ?? 0} />
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
            {projects.map(p => (
              <ProjectCard
                key={p.slug}
                slug={p.slug}
                name={p.name}
                path={p.path}
                repo={p.repo}
                crewSize={p.crew.length}
                capabilities={p.capabilities}
                lastModified={p.lastModified}
              />
            ))}
          </div>
        )}
      </section>

      {dialogMode && (
        <NewProjectDialog mode={dialogMode} onClose={() => setDialogMode(null)} />
      )}
    </div>
  );
}
