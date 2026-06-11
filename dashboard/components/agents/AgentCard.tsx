"use client";
import { RuntimeBadge } from "@/components/common/RuntimeBadge";
import { Button } from "@/components/common/Button";

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
    <article className="rounded-md border border-line p-4 text-sm space-y-2">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-medium truncate">{agent.name}</h3>
          <RuntimeBadge runtimeId={agent.runtime} />
          {agent.model && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface2 font-mono">{agent.model}</span>
          )}
        </div>
        <Button variant="ghost" onClick={() => onEdit(agent.slug)}>Edit</Button>
      </header>
      {agent.description && <p className="text-ink3">{agent.description}</p>}
      {agent.skills.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {agent.skills.map((s) => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-surface2">{s}</span>
          ))}
        </div>
      )}
      {agent.allowedTools.length > 0 && (
        <p className="text-[10px] text-ink3 font-mono">{agent.allowedTools.join(" · ")}</p>
      )}
    </article>
  );
}
