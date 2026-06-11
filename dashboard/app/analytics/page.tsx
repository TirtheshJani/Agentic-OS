"use client";
import { useCallback, useEffect, useState } from "react";
import { Bars } from "@/components/charts/Bars";
import { Heatmap } from "@/components/charts/Heatmap";

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
      <h1 className="text-xl font-semibold mb-1">Analytics</h1>
      <p className="text-sm text-gray-500 mb-4">
        Token usage and run outcomes across CLI sessions. Costs are estimates; subscription usage does not bill per token.
      </p>

      <div className="flex items-center gap-2 mb-6">
        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm"
        >
          <option value="">All providers</option>
          <option value="claude-code">claude-code</option>
          <option value="gemini-cli">gemini-cli</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">Failed to load analytics: {error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading analytics...</p>}

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
              <div key={label} className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <section>
            <h2 className="text-sm font-semibold mb-2">Tokens per day</h2>
            <Bars
              labels={data.daily.map((d) => d.day)}
              series={[
                { label: "in", values: data.daily.map((d) => d.tokensIn), fill: "rgb(59 130 246)" },
                { label: "out", values: data.daily.map((d) => d.tokensOut), fill: "rgb(16 185 129)" },
              ]}
            />
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-2">Activity</h2>
            <Heatmap data={data.daily.map((d) => ({ day: d.day, value: d.sessions }))} />
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h2 className="text-sm font-semibold mb-2">By model</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-1 pr-2">Model</th>
                    <th className="py-1 pr-2">In</th>
                    <th className="py-1 pr-2">Out</th>
                    <th className="py-1 pr-2">Turns</th>
                    <th className="py-1 pr-2">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byModel.map((m) => (
                    <tr key={m.model} className="border-b border-gray-100 dark:border-gray-900">
                      <td className="py-1 pr-2">{m.model}</td>
                      <td className="py-1 pr-2">{fmt(m.tokensIn)}</td>
                      <td className="py-1 pr-2">{fmt(m.tokensOut)}</td>
                      <td className="py-1 pr-2">{m.turns}</td>
                      <td className="py-1 pr-2">{m.cost != null ? `$${m.cost.toFixed(2)}` : "n/a"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <h2 className="text-sm font-semibold mb-2">By project</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-1 pr-2">Project</th>
                    <th className="py-1 pr-2">Sessions</th>
                    <th className="py-1 pr-2">In</th>
                    <th className="py-1 pr-2">Out</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byProject.map((p) => (
                    <tr key={p.projectSlug} className="border-b border-gray-100 dark:border-gray-900">
                      <td className="py-1 pr-2">{p.projectSlug}</td>
                      <td className="py-1 pr-2">{p.sessions}</td>
                      <td className="py-1 pr-2">{fmt(p.tokensIn)}</td>
                      <td className="py-1 pr-2">{fmt(p.tokensOut)}</td>
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
