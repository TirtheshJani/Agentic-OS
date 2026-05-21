// dashboard/hooks/useRun.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";

export interface RunData {
  id: number;
  issueId: number;
  agentSlug: string;
  runtimeId: string;
  worktreePath: string;
  ptySessionId: string | null;
  startedAt: number;
  endedAt: number | null;
  exitStatus: string | null;
}

export function useRunsForIssue(issueId: number) {
  const [runs, setRuns] = useState<RunData[] | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/runs?issueId=${issueId}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setRuns(data.runs);
  }, [issueId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "issue.changed" && (event as any).id === issueId) reload();
  });

  // Poll for session_id updates and exit transitions every 2s as backup.
  useEffect(() => {
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [reload]);

  return { runs, reload };
}
