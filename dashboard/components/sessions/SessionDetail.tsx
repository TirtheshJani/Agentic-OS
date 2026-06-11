"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
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

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading session...</p>;

  const { summary } = data;
  const pages = Math.ceil(data.totalMessages / data.pageSize);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gray-200 dark:border-gray-800 p-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <span className="text-gray-500">Provider</span>
          <div>{summary.provider}</div>
        </div>
        <div>
          <span className="text-gray-500">Turns (user/assistant)</span>
          <div>
            {summary.turnsUser}/{summary.turnsAssistant}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Tool calls</span>
          <div>{summary.toolCalls}</div>
        </div>
        <div>
          <span className="text-gray-500">Tokens in/out</span>
          <div>
            {summary.tokensIn ?? "n/a"} / {summary.tokensOut ?? "n/a"}
          </div>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">Working directory</span>
          <div className="truncate" title={summary.projectDir ?? undefined}>
            {summary.projectDir ?? "?"}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Started</span>
          <div>{summary.startedAt ? new Date(summary.startedAt).toLocaleString() : "?"}</div>
        </div>
        <div>
          <span className="text-gray-500">Est. cost</span>
          <div>{summary.costEstimate != null ? `$${summary.costEstimate.toFixed(2)}` : "n/a"}</div>
        </div>
      </div>

      <div className="space-y-3">
        {data.messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "rounded-md border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/30 p-3"
                : "rounded-md border-l-4 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3"
            }
          >
            <div className="text-xs text-gray-500 mb-1">
              {m.role}
              {m.model ? ` · ${m.model}` : ""}
              {m.timestamp ? ` · ${new Date(m.timestamp).toLocaleTimeString()}` : ""}
            </div>
            {m.text && <pre className="whitespace-pre-wrap text-sm font-sans">{m.text}</pre>}
            {m.toolCalls.map((t, j) => (
              <details key={j} className="mt-1 text-xs">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400">tool: {t.name}</summary>
                <pre className="whitespace-pre-wrap mt-1 p-2 rounded bg-gray-100 dark:bg-gray-800 overflow-x-auto">
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
          <span className="text-gray-500">
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
