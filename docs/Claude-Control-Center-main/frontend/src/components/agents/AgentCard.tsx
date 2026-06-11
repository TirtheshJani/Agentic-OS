import { Bot, Pencil, Trash2, Wrench } from 'lucide-react';
import type { ManagedAgent } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  agent: ManagedAgent;
  onEdit?: (agent: ManagedAgent) => void;
  onDelete?: (agent: ManagedAgent) => void;
}

export function AgentCard({ agent, onEdit, onDelete }: Props) {
  return (
    <div
      className="card px-4 py-3 flex flex-col gap-2 hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-center gap-2">
        <Bot size={15} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {agent.name}
        </span>
        <span className="chip ml-auto" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
          {agent.model}
        </span>
      </div>

      {agent.system && (
        <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
          {agent.system}
        </p>
      )}

      <div className="flex items-center gap-3 mt-1">
        {agent.tools?.length > 0 && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <Wrench size={11} />
            {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
          </span>
        )}
        {agent.mcp_servers?.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {agent.mcp_servers.length} MCP server{agent.mcp_servers.length !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {onEdit && (
            <button
              onClick={() => onEdit(agent)}
              className="p-1.5 rounded hover:bg-white/10 transition-all"
              title="Edit"
            >
              <Pencil size={12} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(agent)}
              className="p-1.5 rounded hover:bg-white/10 transition-all"
              title="Delete"
            >
              <Trash2 size={12} style={{ color: '#f85149' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
