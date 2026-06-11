import { Box, Pencil, Trash2, Globe, Package } from 'lucide-react';
import type { AgentEnvironment } from '../../types';

interface Props {
  env: AgentEnvironment;
  onEdit?: (env: AgentEnvironment) => void;
  onDelete?: (env: AgentEnvironment) => void;
}

export function EnvironmentCard({ env, onEdit, onDelete }: Props) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-2 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-2">
        <Box size={15} style={{ color: '#2dd4bf' }} />
        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {env.name}
        </span>
        {env.network_access && (
          <span className="chip" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
            <Globe size={10} className="mr-1 inline" />
            network
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {env.packages?.length > 0 && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <Package size={11} />
            {env.packages.length} package{env.packages.length !== 1 ? 's' : ''}
          </span>
        )}
        {env.files?.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {env.files.length} file{env.files.length !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {onEdit && (
            <button onClick={() => onEdit(env)} className="p-1.5 rounded hover:bg-white/10 transition-all" title="Edit">
              <Pencil size={12} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(env)} className="p-1.5 rounded hover:bg-white/10 transition-all" title="Delete">
              <Trash2 size={12} style={{ color: '#f85149' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
