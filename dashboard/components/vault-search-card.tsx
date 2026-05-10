"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Hit = { path: string; score: number; snippet: string };

export function VaultSearchCard() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const run = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setHits([]);
      setReason(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/vault/search?q=${encodeURIComponent(query)}`
      );
      const data = (await res.json()) as { hits: Hit[]; reason?: string };
      setHits(data.hits ?? []);
      setReason(data.reason ?? null);
    } catch {
      setHits([]);
      setReason("search failed");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => run(q), 250);
    return () => clearTimeout(id);
  }, [q, run]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search vault markdown..."
          className="w-full text-xs px-2 py-1 rounded border border-border bg-background"
        />
        {searching && (
          <div className="text-xs text-muted-foreground">Searching…</div>
        )}
        {!searching && q.trim().length >= 2 && hits.length === 0 && (
          <div className="text-xs text-muted-foreground">
            {reason ?? "No matches."}
          </div>
        )}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {hits.map((h) => (
            <div key={h.path} className="text-xs space-y-0.5">
              <div className="font-mono truncate" title={h.path}>
                {h.path}
              </div>
              <div className="text-muted-foreground line-clamp-2">
                {h.snippet}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
