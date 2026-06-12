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
          <div className="text-xs text-ink3 mb-1">
            {formatTime(e.timestamp)}
            {" · "}
            {e.kind === "comment" ? e.author : `event: ${e.eventType}`}
          </div>
          <div className="whitespace-pre-wrap font-mono leading-relaxed bg-raise rounded p-2 border border-gray-100 dark:border-gray-800">
            {e.body}
          </div>
        </li>
      ))}
    </ul>
  );
}
