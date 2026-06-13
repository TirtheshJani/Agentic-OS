"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStream } from "@/hooks/useStream";
import { EmptyState } from "@/components/common/EmptyState";
import type { HookEventRow } from "@/lib/hookEvents";

export default function EventsPage() {
  const [events, setEvents] = useState<HookEventRow[] | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/events?limit=200", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events);
    } catch {
      // server restarting; keep last value
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Lifecycle events are written on run start/finalize, which also publish these
  // stream events — reuse them to refresh without a dedicated hook-event channel.
  useStream((e) => {
    if (e.kind === "run.finalized" || e.kind === "issue.changed") reload();
  });

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Events</h1>
        <p className="text-sm text-ink3">
          Run lifecycle events across runtimes. Hook-capable runtimes emit real hook
          events; hookless runtimes show synthetic markers, labeled as such.
        </p>
      </header>

      {events === null ? (
        <p className="text-sm text-ink3">Loading…</p>
      ) : events.length === 0 ? (
        <EmptyState title="No events yet" description="Run lifecycle events will appear here as agents start and finish." />
      ) : (
        <ul className="space-y-1">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 text-sm rounded-md border border-line px-3 py-2"
            >
              <span className="text-ink3 tabular-nums shrink-0 text-xs">
                {new Date(e.receivedAt).toLocaleString()}
              </span>
              <span className="font-medium shrink-0">{e.eventType}</span>
              {e.payload.synthetic ? (
                <span className="text-[9px] font-medium uppercase tracking-wide px-1 py-0.5 rounded bg-surface2 text-ink3 shrink-0">
                  synthetic
                </span>
              ) : (
                <span className="text-[9px] font-medium uppercase tracking-wide px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                  hook
                </span>
              )}
              {e.runtimeId && <span className="text-xs text-ink3 shrink-0">{e.runtimeId}</span>}
              <span className="truncate text-ink2">{e.payload.detail ?? ""}</span>
              {e.issueId != null && (
                <Link href="/issues" className="text-xs text-accent hover:underline ml-auto shrink-0">
                  {e.issueTitle ?? `issue #${e.issueId}`}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
