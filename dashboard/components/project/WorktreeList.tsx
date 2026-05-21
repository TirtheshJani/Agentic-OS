"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/common/Button";

interface WorktreeInfo {
  path: string;
  branch: string | null;
  head: string;
  isActive: boolean;
}

interface Props {
  projectSlug: string;
}

export function WorktreeList({ projectSlug }: Props) {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[] | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectSlug}/worktrees`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setWorktrees(data.worktrees);
  }, [projectSlug]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  async function remove(path: string) {
    if (!confirm(`Remove worktree at ${path}? This deletes any uncommitted work in it.`)) return;
    const res = await fetch(`/api/projects/${projectSlug}/worktrees?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Failed: ${data.error ?? res.status}`);
      return;
    }
    reload();
  }

  if (!worktrees) return null;
  if (worktrees.length === 0) {
    return (
      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Worktrees</h3>
        <p className="text-sm text-gray-400">No worktrees.</p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Worktrees</h3>
      <ul className="space-y-2">
        {worktrees.map(w => (
          <li
            key={w.path}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 p-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs truncate" title={w.path}>{w.path}</div>
              <div className="text-xs text-gray-500 mt-1">
                {w.branch ?? "(detached)"} {w.isActive && <span className="text-green-600 ml-2">active</span>}
              </div>
            </div>
            <Button variant="ghost" onClick={() => remove(w.path)} disabled={w.isActive} title={w.isActive ? "Stop the run first" : ""}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
