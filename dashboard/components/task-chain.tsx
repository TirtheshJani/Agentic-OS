"use client";

import { useEffect, useState } from "react";
import type { TaskRow } from "@/lib/db";

type ChainResponse = {
  root: TaskRow;
  tree: { task: TaskRow; children: TaskRow[] }[];
};

export function TaskChain({ taskId }: { taskId: number }) {
  const [chain, setChain] = useState<ChainResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/tasks/${taskId}/chain`, { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as ChainResponse;
      if (!cancelled) setChain(j);
    };
    load();
    return () => { cancelled = true; };
  }, [taskId]);

  if (!chain) return <div className="text-xs text-muted-foreground">Loading chain…</div>;

  const byParent = new Map<number | null, TaskRow[]>();
  byParent.set(chain.root.id, []);
  for (const { task, children } of chain.tree) {
    byParent.set(task.id, children);
  }

  const render = (task: TaskRow, depth: number): React.ReactNode => {
    const children = byParent.get(task.id) ?? [];
    return (
      <div key={task.id} style={{ marginLeft: depth * 12 }} className="border-l border-border pl-2 my-1">
        <div className="font-mono text-xs">
          <span className="text-muted-foreground">#{task.id}</span>{" "}
          <span className="text-foreground">{task.assignee}</span>{" "}
          <span className="text-muted-foreground">[{task.status}]</span>
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2 pl-2">{task.prompt}</div>
        {children.map((c) => render(c, depth + 1))}
      </div>
    );
  };

  return <div>{render(chain.root, 0)}</div>;
}
