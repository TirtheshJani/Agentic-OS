"use client";
import { useProjects } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/home/ProjectCard";
import { RunningSessionsStrip } from "@/components/home/RunningSessionsStrip";
import { EmptyState } from "@/components/common/EmptyState";
import { useState } from "react";
import { NewProjectDialog } from "@/components/home/NewProjectDialog";

export default function Home() {
  const { projects, error } = useProjects();
  const [dialogMode, setDialogMode] = useState<null | "link" | "clone">(null);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Agentic OS</h1>
        <div className="relative">
          <details className="group">
            <summary className="list-none cursor-pointer text-sm px-3 py-1.5 rounded-md border border-line2 hover:border-accent-line">
              + New Project
            </summary>
            <div className="absolute right-0 mt-1 w-56 rounded-md border border-line bg-surface shadow z-10">
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
      </header>

      <RunningSessionsStrip />

      <section className="mt-6">
        <h2 className="text-sm font-medium text-ink3 uppercase tracking-wide mb-3">Projects</h2>
        {error && (
          <div className="text-sm text-danger">Error: {error}</div>
        )}
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
    </main>
  );
}
