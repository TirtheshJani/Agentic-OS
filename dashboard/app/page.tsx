import { ForecastCard } from "@/components/forecast-card";
import { Header } from "@/components/header";
import { IntegrationsStrip } from "@/components/integrations-strip";
import { OpenIssuesCard } from "@/components/open-issues-card";
import { ProjectStatusCard } from "@/components/project-status-card";
import { RecentRunsCard } from "@/components/recent-runs-card";
import { RunStateProvider } from "@/components/run-state";
import { Starfield } from "@/components/starfield";
import { TeamRail } from "@/components/team-rail";
import { UsageCard } from "@/components/usage-card";
import { VaultRecentCard } from "@/components/vault-recent-card";
import { VaultSearchCard } from "@/components/vault-search-card";
import { Workbench } from "@/components/workbench";
import { loadAgents } from "@/lib/agents-loader";
import { loadProjects } from "@/lib/projects-loader";
import { loadSkills } from "@/lib/skills-loader";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Pulls the first string value out of a Next.js searchParams entry. Arrays
// (?project=a&project=b) collapse to the first element; missing returns null.
function firstParam(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function Page({ searchParams }: PageProps) {
  const skills = loadSkills();
  const projects = loadProjects();
  const agents = loadAgents();

  const sp = await searchParams;
  const requestedSlug = firstParam(sp.project);
  const activeProject = requestedSlug
    ? projects.find((p) => p.slug === requestedSlug) ?? null
    : null;
  // Unknown slugs (?project=does-not-exist) degrade to the no-project view
  // rather than 404. The URL stays as-is so a user fixing a typo can simply
  // change it; we just do not seed any selection or render the status card.
  const activeSlug = activeProject?.slug ?? null;

  return (
    <>
      <Starfield />
      <RunStateProvider>
        <Header />
        <main className="grid grid-cols-[280px_1fr_320px] gap-3 p-3 min-h-[calc(100dvh-3rem)]">
          <Workbench
            skills={skills}
            projects={projects}
            agents={agents}
            initialProjectSlug={activeSlug}
          />
          <aside className="space-y-3 overflow-y-auto">
            <UsageCard />
            <IntegrationsStrip />
            {activeProject && <ProjectStatusCard slug={activeProject.slug} />}
            <OpenIssuesCard />
            <TeamRail agents={agents} />
            <RecentRunsCard
              projectSlug={activeProject?.slug ?? null}
              projectName={activeProject?.name ?? null}
            />
            <VaultRecentCard />
            <VaultSearchCard />
            <ForecastCard />
          </aside>
        </main>
      </RunStateProvider>
    </>
  );
}
