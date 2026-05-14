import { ForecastCard } from "@/components/forecast-card";
import { Header } from "@/components/header";
import { IntegrationsStrip } from "@/components/integrations-strip";
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

export default function Page() {
  const skills = loadSkills();
  const projects = loadProjects();
  const agents = loadAgents();
  return (
    <>
      <Starfield />
      <RunStateProvider>
        <Header />
        <main className="grid grid-cols-[280px_1fr_320px] gap-3 p-3 min-h-[calc(100dvh-3rem)]">
          <Workbench skills={skills} projects={projects} />
          <aside className="space-y-3 overflow-y-auto">
            <UsageCard />
            <IntegrationsStrip />
            <TeamRail agents={agents} />
            <RecentRunsCard />
            <VaultRecentCard />
            <VaultSearchCard />
            <ForecastCard />
          </aside>
        </main>
      </RunStateProvider>
    </>
  );
}
