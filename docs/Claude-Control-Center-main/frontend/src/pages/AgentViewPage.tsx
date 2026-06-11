import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import { useAgentViewAgents } from '../hooks/useAgentView';
import { interruptAgent } from '../api/agentView';
import { cn } from '../lib/utils';

export function AgentViewPage() {
  const { data: agents = [], isLoading } = useAgentViewAgents();
  const [interruptStatus, setInterruptStatus] = useState<Record<string, string>>({});

  const interruptMut = useMutation({
    mutationFn: (name: string) => interruptAgent(name),
    onSuccess: (data, name) => {
      setInterruptStatus((prev) => ({ ...prev, [name]: data.message }));
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bot size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Agent View</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <Bot size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Agent View</h1>
      </div>
      <p className="text-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
        Defined agents in ~/.claude/agents/
      </p>

      {agents.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No agent files found in ~/.claude/agents/</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div key={agent.slug} className="card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {agent.name}
                </span>
                <span
                  className={cn('chip flex-shrink-0 text-xs')}
                  style={agent.isActive
                    ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}
                >
                  {agent.isActive ? 'Active' : 'Idle'}
                </span>
              </div>

              {agent.description && (
                <p
                  className="text-xs leading-relaxed line-clamp-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {agent.description}
                </p>
              )}

              <div className="flex items-center gap-2">
                <span className="chip text-xs" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  {agent.tools.length} tools
                </span>
              </div>

              {agent.isActive && (
                <div>
                  <button
                    className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
                    style={{ background: 'rgba(217,64,64,0.12)', color: 'var(--danger, #ef4444)', border: '1px solid rgba(217,64,64,0.2)' }}
                    onClick={() => interruptMut.mutate(agent.name)}
                    disabled={interruptMut.isPending}
                  >
                    Interrupt
                  </button>
                  {interruptStatus[agent.name] && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      {interruptStatus[agent.name]}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
