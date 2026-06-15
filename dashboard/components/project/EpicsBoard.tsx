"use client";
import { useCallback, useEffect, useState } from "react";
import { Pill } from "@/components/common/Pill";

/** Mirrors the EpicView shape returned by GET /api/epics. */
interface EpicChildView {
  id: number;
  title: string;
  status: string;
  dependsOn: number[];
  eligible: boolean;
}

interface EpicView {
  id: number;
  projectSlug: string;
  title: string;
  why: string;
  milestone: string | null;
  rollup: "empty" | "in-progress" | "done";
  children: EpicChildView[];
}

const ROLLUP_TONE: Record<EpicView["rollup"], "neutral" | "warn" | "ok"> = {
  empty: "neutral",
  "in-progress": "warn",
  done: "ok",
};

const ROLLUP_LABEL: Record<EpicView["rollup"], string> = {
  empty: "empty",
  "in-progress": "in progress",
  done: "done",
};

interface Props {
  /** Omit for the global cross-project view. */
  projectSlug?: string;
}

/**
 * The "Missions" surface (spec 0034 / ADR-027): epics rendered above the kanban,
 * each with its dependency-ordered children and a rollup-status badge. Degrades
 * cleanly: with zero epics it renders nothing.
 */
export function EpicsBoard({ projectSlug }: Props) {
  const [epics, setEpics] = useState<EpicView[] | null>(null);

  const load = useCallback(async () => {
    const qs = projectSlug ? `?projectSlug=${encodeURIComponent(projectSlug)}` : "";
    const res = await fetch(`/api/epics${qs}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { epics: EpicView[] };
    setEpics(data.epics);
  }, [projectSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  // Render nothing until loaded, and nothing when there are no missions.
  if (!epics || epics.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="font-label text-[11px] uppercase tracking-[0.16em] text-ink3 mb-3">Missions</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {epics.map((epic) => (
          <article key={epic.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-ink">{epic.title}</h3>
              <Pill tone={ROLLUP_TONE[epic.rollup]} className="shrink-0">
                {ROLLUP_LABEL[epic.rollup]}
              </Pill>
            </div>
            {epic.why && <p className="mt-1 text-sm text-ink3">{epic.why}</p>}
            {epic.milestone && (
              <p className="mt-1 text-xs text-ink3">Milestone: {epic.milestone}</p>
            )}
            {epic.children.length > 0 && (
              <ul className="mt-3 space-y-1">
                {epic.children.map((child) => (
                  <li key={child.id} className="flex items-center gap-2 text-sm">
                    {!child.eligible && (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full bg-danger-bg px-2 py-0.5 font-label text-[10px] uppercase tracking-wide text-danger"
                        title="Blocked: an upstream dependency has not passed yet"
                      >
                        blocked
                      </span>
                    )}
                    <span className="text-ink truncate">{child.title}</span>
                    <span className="ml-auto shrink-0 font-label text-[10px] uppercase tracking-wide text-ink3">{child.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
