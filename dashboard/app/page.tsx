import { ForecastCard } from "@/components/forecast-card";
import { RecentRunsCard } from "@/components/recent-runs-card";
import { UsageCard } from "@/components/usage-card";
import { VaultRecentCard } from "@/components/vault-recent-card";
import { Workbench } from "@/components/workbench";
import { loadSkills } from "@/lib/skills-loader";

export const dynamic = "force-dynamic";

export default function Page() {
  const skills = loadSkills();
  return (
    <main className="grid grid-cols-[280px_1fr_320px] gap-3 p-3 min-h-dvh">
      <Workbench skills={skills} />
      <aside className="space-y-3 overflow-y-auto">
        <UsageCard />
        <RecentRunsCard />
        <VaultRecentCard />
        <ForecastCard />
      </aside>
    </main>
  );
}
