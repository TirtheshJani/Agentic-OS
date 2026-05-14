"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import type { Agent } from "@/lib/agents-loader";
import type { TaskRow } from "@/lib/db";

// Inlined to avoid pulling node:fs (from agents-loader value imports) into the
// client bundle. Keep in sync with DEPARTMENT_ORDER in lib/agents-loader.ts.
const DEPARTMENT_ORDER = [
  "research",
  "coding",
  "content",
  "business",
  "productivity",
] as const;

function agentsByDepartment(agents: Agent[]): Map<string, Agent[]> {
  const map = new Map<string, Agent[]>();
  for (const dept of DEPARTMENT_ORDER) map.set(dept, []);
  for (const a of agents) {
    if (!map.has(a.department)) map.set(a.department, []);
    map.get(a.department)!.push(a);
  }
  return map;
}

export function TeamRail({ agents }: { agents: Agent[] }) {
  const byDept = agentsByDepartment(agents);
  const [counts, setCounts] = useState<Record<string, { queued: number; claimed: number }>>({});

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [q, c] = await Promise.all([
          fetch("/api/tasks?status=queued", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/tasks?status=claimed", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        const next: Record<string, { queued: number; claimed: number }> = {};
        for (const dept of DEPARTMENT_ORDER) next[dept] = { queued: 0, claimed: 0 };
        for (const t of (q.tasks ?? []) as TaskRow[]) {
          if (t.department && next[t.department]) next[t.department].queued++;
        }
        for (const t of (c.tasks ?? []) as TaskRow[]) {
          if (t.department && next[t.department]) next[t.department].claimed++;
        }
        setCounts(next);
      } catch {
        // silent
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="TEAM" meta={<Pill tone="muted">{agents.length}</Pill>} />
      {agents.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          No agents. Author profiles under <span className="font-mono">agents/</span>.
        </div>
      )}
      <div className="space-y-2 mt-1">
        {DEPARTMENT_ORDER.map((dept) => {
          const list = byDept.get(dept) ?? [];
          if (list.length === 0) return null;
          const c = counts[dept] ?? { queued: 0, claimed: 0 };
          return (
            <div key={dept}>
              <div className="flex items-center justify-between mono-label text-muted-foreground px-1 py-0.5 uppercase">
                <span>{dept}</span>
                <span className="flex items-center gap-1">
                  {c.queued > 0 && <Pill tone="warn">Q · {c.queued}</Pill>}
                  {c.claimed > 0 && <Pill tone="muted">C · {c.claimed}</Pill>}
                </span>
              </div>
              <ul className="space-y-0.5">
                {list.map((a) => (
                  <li key={a.name} className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="truncate" title={a.description}>{a.name}</span>
                    <Pill tone={a.role === "lead" ? "good" : "muted"}>
                      {a.role.toUpperCase()}
                    </Pill>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
