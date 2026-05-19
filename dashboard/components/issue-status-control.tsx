"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/pill";
import type { TaskStatus } from "@/lib/db";

// Mirror of the legality table in lib/tasks.ts. Kept in sync by hand: the
// server enforces it, this is just to gray out illegal targets in the UI.
const LEGAL_NEXT: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["queued", "failed"],
  queued: ["claimed", "running", "failed"],
  claimed: ["running", "queued", "failed"],
  running: ["review", "done", "failed"],
  review: ["done", "running", "failed"],
  done: ["review"],
  failed: ["backlog", "queued"],
};

const ALL_STATUS: TaskStatus[] = [
  "backlog",
  "queued",
  "claimed",
  "running",
  "review",
  "done",
  "failed",
];

function pillToneFor(s: TaskStatus): "default" | "muted" | "good" | "warn" | "bad" {
  switch (s) {
    case "backlog":
      return "muted";
    case "queued":
      return "warn";
    case "claimed":
      return "muted";
    case "running":
      return "good";
    case "review":
      return "warn";
    case "done":
      return "good";
    case "failed":
      return "bad";
  }
}

function useStatusMutation(taskId: number, status: TaskStatus) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as TaskStatus;
    if (next === status) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? `status update failed (${res.status})`);
      } else {
        // Refresh the server component so the status pill + dropdown
        // re-read from the canonical DB row. Per Next 16 docs,
        // router.refresh() re-fetches the closest server-component
        // boundary and re-renders without dropping client state.
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return { busy, err, onChange };
}

export function IssueStatusControl({
  taskId,
  status,
}: {
  taskId: number;
  status: TaskStatus;
}) {
  const legal = new Set(LEGAL_NEXT[status]);
  const { busy, err, onChange } = useStatusMutation(taskId, status);

  return (
    <div className="flex items-center gap-2">
      <Pill tone={pillToneFor(status)}>{status.toUpperCase()}</Pill>
      <select
        value={status}
        onChange={onChange}
        disabled={busy}
        className="rounded-sm border border-border bg-background px-2 py-1 text-xs font-mono"
      >
        {ALL_STATUS.map((s) => (
          <option key={s} value={s} disabled={s !== status && !legal.has(s)}>
            → {s}
          </option>
        ))}
      </select>
      {err && (
        <span className="text-xs font-mono text-[var(--danger)]">{err}</span>
      )}
    </div>
  );
}

// Leaner variant for the board cards: dropdown only, no leading pill (the
// card itself lives inside a column whose header already conveys status).
// On error, falls back to a tiny inline indicator so the card layout does
// not jump.
export function IssueStatusControlCompact({
  taskId,
  status,
}: {
  taskId: number;
  status: TaskStatus;
}) {
  const legal = new Set(LEGAL_NEXT[status]);
  const { busy, err, onChange } = useStatusMutation(taskId, status);

  return (
    <div className="flex items-center gap-1 min-w-0">
      <select
        value={status}
        onChange={onChange}
        disabled={busy}
        title={err ?? "Change status"}
        className="rounded-sm border border-border bg-background px-1 py-0.5 text-[10px] font-mono leading-tight max-w-full"
      >
        {ALL_STATUS.map((s) => (
          <option key={s} value={s} disabled={s !== status && !legal.has(s)}>
            → {s}
          </option>
        ))}
      </select>
      {err && (
        <span
          aria-label={err}
          className="text-[10px] font-mono text-[var(--danger)] shrink-0"
        >
          !
        </span>
      )}
    </div>
  );
}
