"use client";
import { useCallback, useEffect, useState } from "react";

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

const ROLLUP_BADGE: Record<EpicView["rollup"], string> = {
  empty: "bg-surface2 text-ink3 border border-line",
  "in-progress": "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
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
      <h2 className="text-sm font-semibold text-ink3 uppercase tracking-wide mb-3">Missions</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {epics.map((epic) => (
          <article key={epic.id} className="rounded border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-ink">{epic.title}</h3>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${ROLLUP_BADGE[epic.rollup]}`}>
                {ROLLUP_LABEL[epic.rollup]}
              </span>
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
                        className="shrink-0 rounded bg-surface2 px-1.5 py-0.5 text-xs text-ink3 border border-line"
                        title="Blocked: an upstream dependency has not passed yet"
                      >
                        blocked
                      </span>
                    )}
                    <span className="text-ink truncate">{child.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-ink3">{child.status}</span>
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
