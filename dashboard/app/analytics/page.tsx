"use client";
import { useCallback, useEffect, useState } from "react";
import { Bars } from "@/components/charts/Bars";
import { Heatmap } from "@/components/charts/Heatmap";
import { SectionHeader } from "@/components/common/SectionHeader";
import { StatCard } from "@/components/common/StatCard";

interface Analytics {
  daily: Array<{ day: string; tokensIn: number; tokensOut: number; sessions: number; cost: number | null }>;
  byModel: Array<{ model: string; tokensIn: number; tokensOut: number; turns: number; cost: number | null }>;
  byProject: Array<{ projectSlug: string; sessions: number; tokensIn: number; tokensOut: number; cost: number | null }>;
  runOutcomes: Array<{ day: string; done: number; failed: number }>;
  totals: { sessions: number; tokensIn: number; tokensOut: number; cost: number | null; runsDone: number; runsFailed: number };
}

function fmt(v: number): string {
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState("30");
  const [provider, setProvider] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ days });
      if (provider) params.set("provider", provider);
      const res = await fetch(`/api/analytics?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Analytics);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [days, provider]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="max-w-7xl mx-auto p-6">
      <SectionHeader
        kicker="USAGE & COST"
        title="Analytics"
        description="Token usage and run outcomes across CLI sessions. Costs are estimates; subscription usage does not bill per token."
        action={
          <>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="rounded-pill border border-line2 bg-surface px-3 py-1.5 text-sm text-ink"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="rounded-pill border border-line2 bg-surface px-3 py-1.5 text-sm text-ink"
            >
              <option value="">All providers</option>
              <option value="claude-code">claude-code</option>
              <option value="gemini-cli">gemini-cli</option>
            </select>
          </>
        }
      />

      {error && <p className="text-sm text-danger">Failed to load analytics: {error}</p>}
      {!data && !error && <p className="text-sm text-ink3">Loading analytics...</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ["Sessions", String(data.totals.sessions)],
              ["Tokens in", fmt(data.totals.tokensIn)],
              ["Tokens out", fmt(data.totals.tokensOut)],
              ["Est. cost", data.totals.cost != null ? `$${data.totals.cost.toFixed(2)}` : "n/a"],
              ["Runs done/failed", `${data.totals.runsDone}/${data.totals.runsFailed}`],
            ].map(([label, value]) => (
              <StatCard key={label} label={label} value={value} />
            ))}
          </div>

          <section>
            <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-2">Tokens per day</h2>
            <Bars
              labels={data.daily.map((d) => d.day)}
              series={[
                { label: "in", values: data.daily.map((d) => d.tokensIn), fill: "var(--accent)" },
                { label: "out", values: data.daily.map((d) => d.tokensOut), fill: "var(--ok)" },
              ]}
            />
          </section>

          <section>
            <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-2">Activity</h2>
            <Heatmap data={data.daily.map((d) => ({ day: d.day, value: d.sessions }))} />
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-2">By model</h2>
              <table className="w-full border-separate border-spacing-y-1.5 text-sm">
                <thead>
                  <tr className="text-left font-label uppercase tracking-wide text-[10px] text-ink3">
                    <th className="px-3 py-1 font-normal">Model</th>
                    <th className="px-3 py-1 font-normal">In</th>
                    <th className="px-3 py-1 font-normal">Out</th>
                    <th className="px-3 py-1 font-normal">Turns</th>
                    <th className="px-3 py-1 font-normal">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byModel.map((m) => (
                    <tr key={m.model} className="rounded-card border border-line bg-surface">
                      <td className="px-3 py-2 rounded-l-card border-y border-l border-line text-ink">{m.model}</td>
                      <td className="px-3 py-2 border-y border-line font-mono text-ink">{fmt(m.tokensIn)}</td>
                      <td className="px-3 py-2 border-y border-line font-mono text-ink">{fmt(m.tokensOut)}</td>
                      <td className="px-3 py-2 border-y border-line font-mono text-ink">{m.turns}</td>
                      <td className="px-3 py-2 rounded-r-card border-y border-r border-line font-mono text-ink">
                        {m.cost != null ? `$${m.cost.toFixed(2)}` : "n/a"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-2">By project</h2>
              <table className="w-full border-separate border-spacing-y-1.5 text-sm">
                <thead>
                  <tr className="text-left font-label uppercase tracking-wide text-[10px] text-ink3">
                    <th className="px-3 py-1 font-normal">Project</th>
                    <th className="px-3 py-1 font-normal">Sessions</th>
                    <th className="px-3 py-1 font-normal">In</th>
                    <th className="px-3 py-1 font-normal">Out</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byProject.map((p) => (
                    <tr key={p.projectSlug} className="rounded-card border border-line bg-surface">
                      <td className="px-3 py-2 rounded-l-card border-y border-l border-line text-ink">{p.projectSlug}</td>
                      <td className="px-3 py-2 border-y border-line font-mono text-ink">{p.sessions}</td>
                      <td className="px-3 py-2 border-y border-line font-mono text-ink">{fmt(p.tokensIn)}</td>
                      <td className="px-3 py-2 rounded-r-card border-y border-r border-line font-mono text-ink">
                        {fmt(p.tokensOut)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
