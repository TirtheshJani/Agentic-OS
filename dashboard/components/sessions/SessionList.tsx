"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { Pill } from "@/components/common/Pill";
import { useStream } from "@/hooks/useStream";

interface SessionRow {
  id: number;
  provider: string;
  sessionId: string;
  projectDir: string | null;
  projectSlug: string | null;
  runId: number | null;
  startedAt: number | null;
  turnsUser: number;
  turnsAssistant: number;
  toolCalls: number;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimate: number | null;
}

function fmtTokens(v: number | null): string {
  if (v == null) return "n/a";
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

export function SessionList() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [provider, setProvider] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (provider) params.set("provider", provider);
      const res = await fetch(`/api/sessions?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions(((await res.json()) as { sessions: SessionRow[] }).sessions);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [provider]);

  useEffect(() => {
    void load();
  }, [load]);

  useStream((event) => {
    if (event.kind === "sessions.indexed") void load();
  });

  async function rescan() {
    setScanning(true);
    try {
      await fetch("/api/sessions", { method: "POST" });
      await load();
    } finally {
      setScanning(false);
    }
  }

  if (error) return <p className="text-sm text-danger">Failed to load sessions: {error}</p>;
  if (!sessions) return <p className="text-sm text-ink3">Loading sessions...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-pill border border-line2 bg-surface px-3 py-1.5 text-sm text-ink"
        >
          <option value="">All providers</option>
          <option value="claude-code">claude-code</option>
          <option value="gemini-cli">gemini-cli</option>
        </select>
        <Button onClick={rescan} disabled={scanning}>
          {scanning ? "Scanning..." : "Rescan"}
        </Button>
      </div>
      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions indexed"
          description="CLI transcripts from ~/.claude and ~/.gemini appear here after the first scan."
        />
      ) : (
        <table className="w-full border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className="text-left font-label uppercase tracking-wide text-[10px] text-ink3">
              <th className="px-3 py-1 font-normal">Provider</th>
              <th className="px-3 py-1 font-normal">Project</th>
              <th className="px-3 py-1 font-normal">Started</th>
              <th className="px-3 py-1 font-normal">Turns</th>
              <th className="px-3 py-1 font-normal">Tokens in/out</th>
              <th className="px-3 py-1 font-normal">Est. cost</th>
              <th className="px-3 py-1 font-normal">Run</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="rounded-card border border-line bg-surface hover:border-accent-line">
                <td className="px-3 py-2 rounded-l-card border-y border-l border-line">
                  <Pill tone={s.provider === "claude-code" ? "warn" : "accent"}>{s.provider}</Pill>
                </td>
                <td className="px-3 py-2 max-w-48 truncate border-y border-line" title={s.projectDir ?? undefined}>
                  <Link href={`/sessions/${s.id}`} className="text-ink hover:text-accent hover:underline">
                    {s.projectSlug ?? s.projectDir?.split(/[\\/]/).pop() ?? s.sessionId.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink3 border-y border-line">
                  {s.startedAt ? new Date(s.startedAt).toLocaleString() : "?"}
                </td>
                <td className="px-3 py-2 font-mono text-ink border-y border-line">
                  {s.turnsUser}/{s.turnsAssistant}
                </td>
                <td className="px-3 py-2 font-mono text-ink border-y border-line">
                  {fmtTokens(s.tokensIn)} / {fmtTokens(s.tokensOut)}
                </td>
                <td className="px-3 py-2 font-mono text-ink border-y border-line">
                  {s.costEstimate != null ? `$${s.costEstimate.toFixed(2)}` : "n/a"}
                </td>
                <td className="px-3 py-2 rounded-r-card border-y border-r border-line">
                  {s.runId != null && (
                    <span className="rounded-pill bg-surface2 px-2 py-0.5 font-mono text-xs text-ink2">run {s.runId}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-ink3">
        Costs are estimates from public per-token prices; subscription usage does not bill per token.
      </p>
    </div>
  );
}
