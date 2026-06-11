import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Circle, Download, Trash2 } from 'lucide-react';
import { fetchMcpStatus, installMcp, uninstallMcp } from '../../api/mcpBridge';
import { queryKeys } from '../../lib/queryKeys';

interface Props {
  agent: 'claude' | 'codex' | 'gemini';
}

const AGENT_LABELS: Record<Props['agent'], string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
};

export function McpInstallCard({ agent }: Props) {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: queryKeys.mcpBridgeStatus(),
    queryFn: fetchMcpStatus,
    staleTime: 30_000,
  });

  const agentStatus = status?.[agent];
  const installed = agentStatus?.installed ?? false;

  const { mutate: install, isPending: installing } = useMutation({
    mutationFn: () => installMcp(agent),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mcpBridgeStatus() }),
  });

  const { mutate: uninstall, isPending: uninstalling } = useMutation({
    mutationFn: () => uninstallMcp(agent),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mcpBridgeStatus() }),
  });

  return (
    <div className="card px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {AGENT_LABELS[agent]}
        </span>
        {isLoading ? (
          <div className="skeleton h-4 w-16 rounded" />
        ) : installed ? (
          <span className="flex items-center gap-1 text-xs" style={{ color: '#4ade80' }}>
            <CheckCircle size={12} /> Installed
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <Circle size={12} /> Not installed
          </span>
        )}
      </div>

      {agentStatus?.path && (
        <p className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>
          {agentStatus.path}
        </p>
      )}

      {!isLoading && (
        installed ? (
          <button
            onClick={() => uninstall()}
            disabled={uninstalling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs hover:bg-white/10 transition-all disabled:opacity-40"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            <Trash2 size={11} />
            {uninstalling ? 'Uninstalling…' : 'Uninstall'}
          </button>
        ) : (
          <button
            onClick={() => install()}
            disabled={installing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Download size={11} />
            {installing ? 'Installing…' : 'Install'}
          </button>
        )
      )}
    </div>
  );
}
