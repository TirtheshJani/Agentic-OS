import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <main className="max-w-5xl mx-auto p-6">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span>{project.slug}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-gray-500 mt-1" title={project.path}>{project.path}</p>
        {project.repo && (
          <a href={project.repo} className="text-sm text-blue-600 hover:underline mt-1 inline-block" target="_blank" rel="noreferrer">
            {project.repo}
          </a>
        )}
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Crew</h2>
          {project.crew.length === 0 ? (
            <p className="text-sm text-gray-400">No crew yet. Crew editing ships in Phase 2.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {project.crew.map(s => <li key={s} className="font-mono">{s}</li>)}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Capabilities</h2>
          {project.capabilities.length === 0 ? (
            <p className="text-sm text-gray-400">No capabilities tagged.</p>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {project.capabilities.map(c => (
                <span key={c} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-900">{c}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Kanban</h2>
        <p className="text-sm text-gray-400">Issues board ships in Phase 2.</p>
      </section>
    </main>
  );
}
