"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <CardTitle>Vault — recent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {changes.length === 0 && (
          <div className="text-xs text-muted-foreground">No changes yet.</div>
        )}
        {changes.map((c) => (
          <div key={c.id} className="text-xs font-mono truncate">
            <span className="text-muted-foreground">{c.kind} </span>
            {c.path}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
