"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Run = {
  id: number;
  skill_slug: string;
  status: "queued" | "running" | "done" | "error";
  started_at: number;
  duration_ms: number | null;
};

export function RecentRunsCard() {
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        const j = await res.json();
        if (!cancelled) setRuns(j.runs ?? []);
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent runs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {runs.length === 0 && (
          <div className="text-xs text-muted-foreground">No runs yet.</div>
        )}
        {runs.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-xs">
            <span className="truncate font-mono">{r.skill_slug}</span>
            <Badge variant={badgeFor(r.status)}>{r.status}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function badgeFor(
  s: Run["status"]
): "default" | "muted" | "success" | "destructive" {
  if (s === "done") return "success";
  if (s === "error") return "destructive";
  if (s === "running") return "default";
  return "muted";
}
