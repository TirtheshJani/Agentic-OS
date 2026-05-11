"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";

type Change = { id: number; path: string; kind: string; ts: number };

export function VaultRecentCard() {
  const [changes, setChanges] = useState<Change[]>([]);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/vault/recent", { cache: "no-store" });
        const j = await res.json();
        if (!cancelled) setChanges(j.changes ?? []);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="VAULT · RECENT" />
      {changes.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">No changes yet.</div>
      )}
      <ul className="space-y-0.5 mt-1">
        {changes.map((c) => (
          <li key={c.id} className="text-xs font-mono truncate">
            <span className="text-muted-foreground">{c.kind} </span>{c.path}
          </li>
        ))}
      </ul>
    </div>
  );
}
