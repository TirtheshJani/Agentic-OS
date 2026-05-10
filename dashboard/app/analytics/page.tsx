import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  runsBySkill,
  runsByDomain,
  runsByWeek,
  totalRuns,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const total = totalRuns();
  const bySkill = runsBySkill(20);
  const byDomain = runsByDomain();
  const byWeek = runsByWeek(12);
  const maxSkill = Math.max(1, ...bySkill.map((r) => r.count));
  const maxDomain = Math.max(1, ...byDomain.map((r) => r.count));
  const maxWeek = Math.max(1, ...byWeek.map((r) => r.count));

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Workbench
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Total runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono">{total}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>By skill (top {bySkill.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {bySkill.length === 0 && (
              <div className="text-xs text-muted-foreground">No runs yet.</div>
            )}
            {bySkill.map((r) => (
              <Bar
                key={r.skill}
                label={r.skill}
                value={r.count}
                max={maxSkill}
                hint={r.status}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By domain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {byDomain.length === 0 && (
              <div className="text-xs text-muted-foreground">No runs yet.</div>
            )}
            {byDomain.map((r) => (
              <Bar
                key={r.domain}
                label={r.domain}
                value={r.count}
                max={maxDomain}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By week (last {byWeek.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {byWeek.length === 0 && (
            <div className="text-xs text-muted-foreground">No runs yet.</div>
          )}
          {byWeek.map((r) => (
            <Bar
              key={r.week}
              label={r.week}
              value={r.count}
              max={maxWeek}
            />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

function Bar({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
}) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div className="text-xs space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono truncate">{label}</span>
        <span className="text-muted-foreground shrink-0 font-mono">
          {value}
          {hint && (
            <span className="ml-2 text-[10px] uppercase tracking-wide">
              {hint}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded">
        <div
          className="h-full bg-foreground/70 rounded"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
