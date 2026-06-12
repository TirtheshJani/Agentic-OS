"use client";
import { useCallback, useEffect, useState } from "react";
import type { Settings } from "@/lib/settings";

let cached: Settings | null = null;

/**
 * Client-side settings reader shared across shell components. Refetches on
 * focus and every 30s (same posture as the old AutonomyPill polling); patch()
 * writes through /api/settings and updates the shared cache.
 */
export function useSettings() {
  const [settings, setState] = useState<Settings | null>(cached);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Settings;
      cached = data;
      setState(data);
    } catch {
      // server restarting; keep last value
    }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 30_000);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const patch = useCallback(async (p: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as Settings;
      cached = data;
      setState(data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { settings, reload, patch };
}
