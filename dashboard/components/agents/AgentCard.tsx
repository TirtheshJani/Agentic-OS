"use client";
import { RuntimeBadge } from "@/components/common/RuntimeBadge";
import { Button } from "@/components/common/Button";
import { Pill } from "@/components/common/Pill";

export interface AgentSummary {
  slug: string;
  name: string;
  description: string | null;
  runtime: string;
  model: string | null;
  skills: string[];
  allowedTools: string[];
  lastModified: number;
}

interface Props {
  agent: AgentSummary;
  onEdit: (slug: string) => void;
}

export function AgentCard({ agent, onEdit }: Props) {
  return (
    <article className="rounded-card border border-line bg-surface p-4 text-sm space-y-2.5 shadow-card transition-colors hover:border-accent-line">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-ink truncate">{agent.name}</h3>
          <p className="font-mono text-[11px] text-ink3 truncate">{agent.slug}</p>
        </div>
        <Button variant="ghost" onClick={() => onEdit(agent.slug)}>Edit</Button>
      </header>
      <div className="flex items-center gap-1.5 flex-wrap">
        <RuntimeBadge runtimeId={agent.runtime} />
        {agent.model && (
          <Pill tone="neutral" className="font-mono normal-case tracking-normal">{agent.model}</Pill>
        )}
      </div>
      {agent.description && <p className="text-ink2">{agent.description}</p>}
      {agent.skills.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {agent.skills.map((s) => (
            <Pill key={s} tone="accent">{s}</Pill>
          ))}
        </div>
      )}
      {agent.allowedTools.length > 0 && (
        <p className="text-[10px] text-ink3 font-mono">{agent.allowedTools.join(" · ")}</p>
      )}
    </article>
  );
}
