"use client";
import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";
import type { RunWithIssue } from "@/lib/runs";

export interface ActivityData {
  active: RunWithIssue[];
  recent: RunWithIssue[];
}

export function useActivity() {
  const [data, setData] = useState<ActivityData | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // server restarting; keep last value
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "issue.changed" || event.kind === "run.finalized") reload();
  });

  return { data, reload };
}
