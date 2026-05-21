import { listProjects } from "@/lib/projects";
import { ProjectCard } from "@/components/home/ProjectCard";
import { RunningSessionsStrip } from "@/components/home/RunningSessionsStrip";
import { EmptyState } from "@/components/common/EmptyState";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = listProjects();

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Agentic OS</h1>
        <button
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled
          title="New Project flow ships in Phase 2"
        >
          + New Project
        </button>
      </header>

      <RunningSessionsStrip />

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Projects</h2>
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" description="Add a project via vault/projects/<slug>/PROJECT.md, then refresh." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map(p => (
              <ProjectCard
                key={p.slug}
                slug={p.slug}
                name={p.name}
                path={p.path}
                repo={p.repo ?? null}
                crewSize={p.crew.length}
                capabilities={p.capabilities}
                lastModified={p.lastModified}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
