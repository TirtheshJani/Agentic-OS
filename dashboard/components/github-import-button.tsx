"use client";

// Phase 8.5 — "Import from GitHub" board header button.
//
// Posts to /api/projects/<slug>/import, then router.refresh() so the
// kanban columns reflect any new rows without a hard reload. Errors
// surface inline; a non-empty errors[] from the server is displayed as
// a warning but does not block the count line.

import { useRouter } from "next/navigation";
import { useState } from "react";

type Summary = {
  repo?: string;
  imported?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
};

export function GithubImportButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/import`,
        { method: "POST" }
      );
      const j = (await res.json()) as Summary & { error?: string };
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setSummary(j);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="mono-label px-2 py-1 border border-border rounded-sm hover:bg-muted/40 disabled:opacity-50"
      >
        {busy ? "IMPORTING…" : "IMPORT FROM GITHUB"}
      </button>
      {summary && (
        <span className="text-xs text-muted-foreground font-mono">
          imported {summary.imported ?? 0}, updated {summary.updated ?? 0},
          skipped {summary.skipped ?? 0}
          {Array.isArray(summary.errors) && summary.errors.length > 0 && (
            <span className="text-[var(--warn)]">
              {" "}· {summary.errors.length} error{summary.errors.length === 1 ? "" : "s"}: {summary.errors[0]}
            </span>
          )}
        </span>
      )}
      {error && (
        <span className="text-xs text-[var(--danger)] font-mono">{error}</span>
      )}
    </div>
  );
}
