"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Pill } from "@/components/common/Pill";
import type { SessionMessage } from "@/lib/sessions/parseClaude";

interface DetailResponse {
  summary: {
    provider: string;
    sessionId: string;
    projectDir: string | null;
    projectSlug: string | null;
    runId: number | null;
    startedAt: number | null;
    endedAt: number | null;
    turnsUser: number;
    turnsAssistant: number;
    toolCalls: number;
    tokensIn: number | null;
    tokensOut: number | null;
    costEstimate: number | null;
  };
  messages: SessionMessage[];
  totalMessages: number;
  page: number;
  pageSize: number;
}

export function SessionDetail({ id }: { id: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${id}?page=${page}`, { cache: "no-store" });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      setData((await res.json()) as DetailResponse);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id, page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <p className="text-sm text-ink3">Loading session...</p>;

  const { summary } = data;
  const pages = Math.ceil(data.totalMessages / data.pageSize);

  return (
    <div className="space-y-4">
      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <span className="font-label uppercase tracking-wide text-[10px] text-ink3">Provider</span>
          <div className="mt-0.5">
            <Pill tone={summary.provider === "claude-code" ? "warn" : "accent"}>{summary.provider}</Pill>
          </div>
        </div>
        <div>
          <span className="font-label uppercase tracking-wide text-[10px] text-ink3">Turns (user/assistant)</span>
          <div className="mt-0.5 font-mono text-ink">
            {summary.turnsUser}/{summary.turnsAssistant}
          </div>
        </div>
        <div>
          <span className="font-label uppercase tracking-wide text-[10px] text-ink3">Tool calls</span>
          <div className="mt-0.5 font-mono text-ink">{summary.toolCalls}</div>
        </div>
        <div>
          <span className="font-label uppercase tracking-wide text-[10px] text-ink3">Tokens in/out</span>
          <div className="mt-0.5 font-mono text-ink">
            {summary.tokensIn ?? "n/a"} / {summary.tokensOut ?? "n/a"}
          </div>
        </div>
        <div className="col-span-2">
          <span className="font-label uppercase tracking-wide text-[10px] text-ink3">Working directory</span>
          <div className="mt-0.5 truncate font-mono text-ink2" title={summary.projectDir ?? undefined}>
            {summary.projectDir ?? "?"}
          </div>
        </div>
        <div>
          <span className="font-label uppercase tracking-wide text-[10px] text-ink3">Started</span>
          <div className="mt-0.5 text-ink">{summary.startedAt ? new Date(summary.startedAt).toLocaleString() : "?"}</div>
        </div>
        <div>
          <span className="font-label uppercase tracking-wide text-[10px] text-ink3">Est. cost</span>
          <div className="mt-0.5 font-mono text-ink">{summary.costEstimate != null ? `$${summary.costEstimate.toFixed(2)}` : "n/a"}</div>
        </div>
      </Card>

      <div className="space-y-3">
        {data.messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "rounded-card border border-line border-l-4 border-l-accent bg-accent-bg p-3"
                : "rounded-card border border-line border-l-4 border-l-line2 bg-raise p-3"
            }
          >
            <div className="text-xs text-ink3 mb-1">
              {m.role}
              {m.model ? ` · ${m.model}` : ""}
              {m.timestamp ? ` · ${new Date(m.timestamp).toLocaleTimeString()}` : ""}
            </div>
            {m.text && <pre className="whitespace-pre-wrap text-sm font-sans text-ink">{m.text}</pre>}
            {m.toolCalls.map((t, j) => (
              <details key={j} className="mt-1 text-xs">
                <summary className="cursor-pointer text-ink2">tool: {t.name}</summary>
                <pre className="whitespace-pre-wrap mt-1 p-2 rounded-card bg-surface2 font-mono text-ink2 overflow-x-auto">
                  {t.inputPreview}
                </pre>
              </details>
            ))}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Previous
          </Button>
          <span className="text-ink3">
            Page {page + 1} of {pages}
          </span>
          <Button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
