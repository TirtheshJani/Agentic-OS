import Link from "next/link";
import { listProjects } from "@/lib/projects";
import { EmptyState } from "@/components/common/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  const projects = listProjects();
  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader
        kicker="DESIGN STUDIO"
        title="Design Studio"
        description="Architecture diagrams and design docs per project, stored in the vault and readable by agents."
      />
      {projects.length === 0 ? (
        <EmptyState title="No projects" description="Create or link a project first." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <Link
              key={p.slug}
              href={`/studio/${p.slug}`}
              className="rounded-card border border-line bg-surface p-4 transition-colors hover:border-accent-line"
            >
              <span className="font-semibold text-sm text-ink">{p.name}</span>
              <p className="text-xs text-ink3 mt-1 font-mono">{p.slug}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
