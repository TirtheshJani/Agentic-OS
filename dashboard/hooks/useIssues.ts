// dashboard/hooks/useIssues.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";

export interface IssueSummary {
  id: number;
  projectSlug: string;
  title: string;
  body: string;
  assigneeSlug: string | null;
  status: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  mode: "sync" | "async";
  priority: number;
  labels: string[];
  createdAt: number;
  updatedAt: number;
}

export function useIssues(projectSlug: string) {
  const [issues, setIssues] = useState<IssueSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/issues?projectSlug=${encodeURIComponent(projectSlug)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIssues(data.issues);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectSlug]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "issue.changed" && (event as any).projectSlug === projectSlug) {
      reload();
    }
  });

  return { issues, error, reload };
}
