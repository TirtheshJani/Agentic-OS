import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, CheckCircle, AlertCircle, Trash2, Download } from 'lucide-react';
import { fetchGwsBridgeStatus, installGwsBridge, uninstallGwsBridge } from '../../api/gws';
import { queryKeys } from '../../lib/queryKeys';

export function CodexBridgeCard() {
  const qc = useQueryClient();

  const { data: bridge, isLoading } = useQuery({
    queryKey: queryKeys.gwsBridge(),
    queryFn: fetchGwsBridgeStatus,
    staleTime: 30_000,
  });

  const installMut = useMutation({
    mutationFn: installGwsBridge,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.gwsBridge() }),
  });

  const uninstallMut = useMutation({
    mutationFn: uninstallGwsBridge,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.gwsBridge() }),
  });

  const busy = isLoading || installMut.isPending || uninstallMut.isPending;

  return (
    <div className="card px-4 py-3 flex items-start gap-3">
      <div className="p-2 rounded flex-shrink-0" style={{ background: 'var(--bg-secondary)', color: 'var(--accent)' }}>
        <Box size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Codex Bridge</span>
          {!isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
              style={bridge?.installed
                ? { background: 'var(--success-dim)', color: 'var(--success)' }
                : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}
            >
              {bridge?.installed ? <><CheckCircle size={10} /> Installed</> : 'Not installed'}
            </span>
          )}
          {bridge?.modified_externally && (
            <span className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
              <AlertCircle size={10} /> Modified externally
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Generates <code>~/.codex/skills/gws/SKILL.md</code> so Codex agents can invoke GWS via the executor.
        </p>
        {bridge?.path && (
          <p className="text-xs mt-0.5 font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{bridge.path}</p>
        )}
        {uninstallMut.data && !uninstallMut.data.uninstalled && uninstallMut.data.reason && (
          <p className="text-xs mt-1" style={{ color: '#f87171' }}>{uninstallMut.data.reason}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {bridge?.installed ? (
          <button
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            onClick={() => uninstallMut.mutate()}
            disabled={busy}
            style={{ color: '#f87171' }}
          >
            <Trash2 size={11} />
            {uninstallMut.isPending ? 'Removing…' : 'Remove'}
          </button>
        ) : (
          <button
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            onClick={() => installMut.mutate()}
            disabled={busy}
          >
            <Download size={11} />
            {installMut.isPending ? 'Installing…' : 'Install'}
          </button>
        )}
      </div>
    </div>
  );
}
