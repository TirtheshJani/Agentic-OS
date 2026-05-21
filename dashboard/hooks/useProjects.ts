// dashboard/hooks/useProjects.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";

export interface ProjectSummary {
  slug: string;
  name: string;
  path: string;
  repo: string | null;
  crew: string[];
  capabilities: string[];
  runtimeDefault: string;
  lastModified: number;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(data.projects);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "project.changed") {
      reload();
    }
  });

  return { projects, error, reload };
}
