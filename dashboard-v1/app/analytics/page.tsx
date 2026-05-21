import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  runsBySkill,
  runsByDomain,
  runsByWeek,
  totals,
  costBySkill,
  durationBySkill,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const t = totals();
  const bySkill = runsBySkill(20);
  const byDomain = runsByDomain();
  const byWeek = runsByWeek(12);
  const byCost = costBySkill(10);
  const byDuration = durationBySkill(10);
  const maxSkill = Math.max(1, ...bySkill.map((r) => r.count));
  const maxDomain = Math.max(1, ...byDomain.map((r) => r.count));
  const maxWeek = Math.max(1, ...byWeek.map((r) => r.count));
  const maxCost = Math.max(0.0001, ...byCost.map((r) => r.costUsd));
  const maxDuration = Math.max(1, ...byDuration.map((r) => r.p95Ms));
  const errorRate = t.runs > 0 ? (t.error / t.runs) * 100 : 0;

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total runs" value={String(t.runs)} />
        <Stat
          label="Error rate"
          value={`${errorRate.toFixed(1)}%`}
          hint={`${t.error}/${t.runs}`}
        />
        <Stat
          label="Total cost"
          value={`$${t.costUsd.toFixed(2)}`}
        />
        <Stat
          label="Tokens (in / out)"
          value={`${formatTokens(t.tokensIn)} / ${formatTokens(t.tokensOut)}`}
        />
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>By cost (top {byCost.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {byCost.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No cost data yet.
              </div>
            )}
            {byCost.map((r) => (
              <Bar
                key={r.skill}
                label={r.skill}
                value={r.costUsd}
                max={maxCost}
                display={`$${r.costUsd.toFixed(4)}`}
                hint={`${r.runs} runs`}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Duration p50 / p95 (top {byDuration.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {byDuration.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No duration data yet.
              </div>
            )}
            {byDuration.map((r) => (
              <Bar
                key={r.skill}
                label={r.skill}
                value={r.p95Ms}
                max={maxDuration}
                display={`${formatMs(r.p50Ms)} / ${formatMs(r.p95Ms)}`}
                hint={`${r.runs} runs`}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-mono">{value}</div>
        {hint && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function Bar({
  label,
  value,
  max,
  hint,
  display,
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
  display?: string;
}) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div className="text-xs space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono truncate">{label}</span>
        <span className="text-muted-foreground shrink-0 font-mono">
          {display ?? value}
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
