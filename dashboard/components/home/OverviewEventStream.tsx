"use client";
import { useState } from "react";
import Link from "next/link";
import { useStream, type StreamEventPayload } from "@/hooks/useStream";
import { EmptyState } from "@/components/common/EmptyState";

interface FeedItem {
  id: number;
  label: string;
  at: number;
}

// Human-readable one-liner for each stream event. Unknown kinds fall back to the
// raw kind so nothing is silently dropped.
function describe(e: StreamEventPayload): string | null {
  switch (e.kind) {
    case "ping":
      return null; // keepalive, not user-facing
    case "run.finalized":
      return `run #${e.runId} ${String(e.exitStatus ?? "ended")}`;
    case "issue.changed":
      return `issue #${e.id} ${String(e.reason ?? "changed")}`;
    case "eval.completed":
      return `eval graded run #${e.runId}: ${String(e.grade ?? "?")} (${String(e.score ?? "?")})`;
    case "revision.filed":
      return `revision filed for run #${e.runId}`;
    case "revision.escalated":
      return `run #${e.runId} escalated to review`;
    case "thread.appended":
      return `thread updated on issue #${e.issueId}`;
    case "project.changed":
      return `project ${String(e.slug)} ${String(e.reason ?? "changed")}`;
    case "agent.changed":
      return `agent ${String(e.slug)} ${String(e.reason ?? "changed")}`;
    case "vault.indexed":
      return `vault indexed (${String(e.notes ?? 0)} notes)`;
    case "sessions.indexed":
      return `sessions indexed (${String(e.updated ?? 0)} updated)`;
    case "rag.embeddings":
      return `embeddings: ${String(e.embedded ?? 0)} done, ${String(e.pending ?? 0)} pending`;
    default:
      return e.kind;
  }
}

const MAX_ITEMS = 30;

export function OverviewEventStream() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useStream((event) => {
    const label = describe(event);
    if (!label) return;
    setItems((prev) => {
      const next: FeedItem = { id: (prev[0]?.id ?? 0) + 1, label, at: Date.now() };
      return [next, ...prev].slice(0, MAX_ITEMS);
    });
  });

  return (
    <div className="rounded-md border border-line bg-surface p-3 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3">Event stream</h2>
        <Link href="/activity" className="text-xs text-accent hover:underline">activity →</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Listening…" description="Live events will appear here as runs and issues change." />
      ) : (
        <ul className="space-y-1 overflow-y-auto text-xs" style={{ maxHeight: 280 }}>
          {items.map((it) => (
            <li key={it.id} className="flex items-baseline gap-2">
              <span className="text-ink3 tabular-nums shrink-0">
                {new Date(it.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="truncate">{it.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
