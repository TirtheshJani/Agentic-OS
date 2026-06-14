"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/common/Button";
import { StatusDot } from "@/components/common/StatusDot";

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
        <h3 className="mb-2 font-label text-[11px] uppercase tracking-[0.16em] text-ink3">Worktrees</h3>
        <p className="text-sm text-ink3">No worktrees.</p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h3 className="mb-2 font-label text-[11px] uppercase tracking-[0.16em] text-ink3">Worktrees</h3>
      <ul className="space-y-2">
        {worktrees.map(w => (
          <li
            key={w.path}
            className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-2.5 text-sm shadow-card"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-xs text-ink2" title={w.path}>{w.path}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-ink3">
                <span className="font-mono">{w.branch ?? "(detached)"}</span>
                {w.isActive && (
                  <span className="inline-flex items-center gap-1.5 font-label uppercase tracking-wide text-ok">
                    <StatusDot tone="ok" pulse />
                    active
                  </span>
                )}
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
