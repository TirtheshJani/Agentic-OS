import Link from "next/link";
import { ForecastCard } from "@/components/forecast-card";
import { RecentRunsCard } from "@/components/recent-runs-card";
import { UsageCard } from "@/components/usage-card";
import { VaultRecentCard } from "@/components/vault-recent-card";
import { VaultSearchCard } from "@/components/vault-search-card";
import { Workbench } from "@/components/workbench";
import { loadSkills } from "@/lib/skills-loader";

export const dynamic = "force-dynamic";

export default function Page() {
  const skills = loadSkills();
  return (
    <main className="grid grid-cols-[280px_1fr_320px] gap-3 p-3 min-h-dvh">
      <Workbench skills={skills} />
      <aside className="space-y-3 overflow-y-auto">
        <div className="flex justify-end">
          <Link
            href="/analytics"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Analytics →
          </Link>
        </div>
        <UsageCard />
        <RecentRunsCard />
        <VaultRecentCard />
        <VaultSearchCard />
        <ForecastCard />
      </aside>
    </main>
  );
}
