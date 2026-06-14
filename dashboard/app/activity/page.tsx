import { openDb } from "@/lib/db";
import { listRecentRunsWithIssues } from "@/lib/runs";
import { ensureServerBooted } from "@/lib/server-init";
import { SectionHeader } from "@/components/common/SectionHeader";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await ensureServerBooted();
  openDb();
  const runs = listRecentRunsWithIssues({ limit: 100 });

  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader title="Activity" description="Every run across all projects, newest first." kicker="LIVE FEED" />
      <ActivityFeed runs={runs} />
    </main>
  );
}
