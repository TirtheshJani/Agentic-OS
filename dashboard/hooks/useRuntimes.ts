"use client";
import { useEffect, useState } from "react";
import type { RuntimeCapabilities, RuntimeAvailability } from "@/lib/runtime/types";

export interface RuntimeInfo {
  id: string;
  displayName: string;
  capabilities: RuntimeCapabilities;
  models: Array<{ id: string; label: string }>;
  availability: RuntimeAvailability;
}

let cached: RuntimeInfo[] | null = null;

export function useRuntimes() {
  const [runtimes, setRuntimes] = useState<RuntimeInfo[] | null>(cached);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    fetch("/api/runtimes", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        cached = data.runtimes;
        setRuntimes(data.runtimes);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  return runtimes;
}

export function useRuntime(id: string | null | undefined): RuntimeInfo | null {
  const runtimes = useRuntimes();
  if (!runtimes || !id) return null;
  return runtimes.find((r) => r.id === id) ?? null;
}
