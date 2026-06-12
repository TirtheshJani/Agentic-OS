import Link from "next/link";
import { listProjects } from "@/lib/projects";
import { EmptyState } from "@/components/common/EmptyState";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  const projects = listProjects();
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-1">Design Studio</h1>
      <p className="text-sm text-ink3 mb-6">
        Architecture diagrams and design docs per project, stored in the vault and readable by agents.
      </p>
      {projects.length === 0 ? (
        <EmptyState title="No projects" description="Create or link a project first." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <Link
              key={p.slug}
              href={`/studio/${p.slug}`}
              className="rounded-md border border-line p-4 hover:bg-surface2"
            >
              <span className="font-medium text-sm">{p.name}</span>
              <p className="text-xs text-ink3 mt-1">{p.slug}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
