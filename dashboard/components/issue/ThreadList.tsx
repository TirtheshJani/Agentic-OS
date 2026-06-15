"use client";
import { useEffect, useState, useCallback } from "react";
import { useStream } from "@/hooks/useStream";

interface Entry {
  kind: "comment" | "event";
  author?: string;
  eventType?: string;
  body: string;
  timestamp: string;
}

interface Props {
  issueId: number;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function ThreadList({ issueId }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/issues/${issueId}/thread`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setEntries(data.entries);
  }, [issueId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "thread.appended" && (event as any).issueId === issueId) reload();
  });

  if (entries.length === 0) {
    return <p className="text-sm text-ink3">No comments yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {entries.map((e, i) => (
        <li key={i} className="text-sm">
          <div className="mb-1 flex items-center gap-2 text-xs text-ink3">
            <span className="font-mono">{formatTime(e.timestamp)}</span>
            <span>·</span>
            <span className={e.kind === "comment" ? "text-ink2" : "font-label uppercase tracking-wide text-[10px]"}>
              {e.kind === "comment" ? e.author : `event: ${e.eventType}`}
            </span>
          </div>
          <div className="whitespace-pre-wrap font-mono leading-relaxed bg-surface2 rounded-card p-2.5 border border-line text-ink2">
            {e.body}
          </div>
        </li>
      ))}
    </ul>
  );
}
