import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import {
  DEPARTMENT_ORDER,
  agentsByDepartment,
  type Agent,
} from "@/lib/agents-loader";

export function TeamRail({ agents }: { agents: Agent[] }) {
  const byDept = agentsByDepartment(agents);
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
          return (
            <div key={dept}>
              <div className="mono-label text-muted-foreground px-1 py-0.5 uppercase">
                {dept}
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
