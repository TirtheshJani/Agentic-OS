"use client";

// Phase 9.5: provides a shared agent registry to client components. The
// registry is fetched once on mount; agent profiles are filesystem-backed
// and rarely change, so interval polling would be wasted load.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Agent } from "@/lib/design/types";

type Ctx = {
  agents: Agent[];
  byHandle: Map<string, Agent>;
};

const AgentsContext = createContext<Ctx>({
  agents: [],
  byHandle: new Map(),
});

export function AgentsProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as Agent[];
        if (!cancelled) setAgents(j);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      agents,
      byHandle: new Map(agents.map((a) => [a.handle, a])),
    }),
    [agents]
  );

  return (
    <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>
  );
}

export function useAgents(): Agent[] {
  return useContext(AgentsContext).agents;
}

export function useAgentByHandle(handle: string | null): Agent | null {
  const ctx = useContext(AgentsContext);
  if (!handle) return null;
  return ctx.byHandle.get(handle) ?? null;
}
