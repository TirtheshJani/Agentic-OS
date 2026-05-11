"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";

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
      } catch {}
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="USAGE" meta={<Pill tone="muted">LIVE</Pill>} />
      {!usage && <div className="text-xs text-muted-foreground">Loading…</div>}
      {usage && !usage.available && (
        <div className="text-xs text-muted-foreground">No ~/.claude/usage.json found.</div>
      )}
      {usage && usage.available && (
        <div className="space-y-2 mt-1">
          <Bar label="5-HOUR" w={usage.five_hour} resets={resetsLabel(usage.five_hour.resets_at)} />
          <Bar label="WEEKLY" w={usage.weekly} resets={resetsLabel(usage.weekly.resets_at)} />
        </div>
      )}
    </div>
  );
}

function Bar({ label, w, resets }: { label: string; w: Window; resets: string }) {
  const pct = w.limit > 0 ? Math.min(100, (w.used / w.limit) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mono-label">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-foreground">
            {w.used}/{w.limit}
          </span>
          <Pill tone="muted" glyph="·">{resets}</Pill>
        </span>
      </div>
      <div className="h-1 w-full bg-muted rounded-sm mt-1 overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function resetsLabel(iso: string | null): string {
  if (!iso) return "RESETS · —";
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff < 0) return "RESETS · NOW";
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return "RESETS · <1H";
  if (h < 24) return `RESETS · ${h}H`;
  return `RESETS · ${Math.round(h / 24)}D`;
}
