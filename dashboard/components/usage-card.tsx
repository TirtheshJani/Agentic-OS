"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Window = { used: number; limit: number; resets_at: string | null };
type Usage =
  | { available: false; five_hour: null; weekly: null }
  | { available: true; five_hour: Window; weekly: Window };

export function UsageCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/usage", { cache: "no-store" });
        const j: Usage = await res.json();
        if (!cancelled) setUsage(j);
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!usage && <div className="text-xs text-muted-foreground">Loading…</div>}
        {usage && !usage.available && (
          <div className="text-xs text-muted-foreground">
            Usage data unavailable (no ~/.claude/usage.json).
          </div>
        )}
        {usage && usage.available && (
          <>
            <Bar label="5-hour" w={usage.five_hour} />
            <Bar label="Weekly" w={usage.weekly} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({ label, w }: { label: string; w: Window }) {
  const pct = w.limit > 0 ? Math.min(100, (w.used / w.limit) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          {w.used}/{w.limit}
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded mt-1 overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
