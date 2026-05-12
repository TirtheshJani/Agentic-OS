"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { UsageSnapshot } from "@/components/output-stream";

export type ActiveMcp = { name: string; source: string };

type RunStateValue = {
  running: boolean;
  setRunning: (v: boolean) => void;
  liveUsage: UsageSnapshot;
  mergeUsage: (u: UsageSnapshot) => void;
  resetUsage: () => void;
  currentProject: string | null;
  setCurrentProject: (slug: string | null) => void;
  activeMcp: ActiveMcp | null;
  setActiveMcp: (mcp: ActiveMcp | null) => void;
};

const RunStateContext = createContext<RunStateValue | null>(null);

export function RunStateProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [liveUsage, setLiveUsage] = useState<UsageSnapshot>({});
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [activeMcp, setActiveMcp] = useState<ActiveMcp | null>(null);

  const mergeUsage = useCallback((u: UsageSnapshot) => {
    setLiveUsage((prev) => ({ ...prev, ...u }));
  }, []);
  const resetUsage = useCallback(() => setLiveUsage({}), []);

  const value = useMemo<RunStateValue>(
    () => ({
      running,
      setRunning,
      liveUsage,
      mergeUsage,
      resetUsage,
      currentProject,
      setCurrentProject,
      activeMcp,
      setActiveMcp,
    }),
    [running, liveUsage, mergeUsage, resetUsage, currentProject, activeMcp]
  );

  return <RunStateContext.Provider value={value}>{children}</RunStateContext.Provider>;
}

export function useRunState(): RunStateValue {
  const ctx = useContext(RunStateContext);
  if (!ctx) throw new Error("useRunState must be used inside RunStateProvider");
  return ctx;
}
