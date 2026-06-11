import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, RefreshCw, Play, Terminal, Activity } from 'lucide-react';
import {
  fetchGwsStatus, fetchGwsSnapshot, refreshGwsSnapshot, fetchGwsRecipes, fetchGwsAudit,
} from '../api/gws';
import { relativeTime, cn } from '../lib/utils';
import { queryKeys } from '../lib/queryKeys';
import { DashboardTab } from './workspace/DashboardTab';
import { RecipesTab } from './workspace/RecipesTab';
import { ShellTab } from './workspace/ShellTab';
import { ActivityTab } from './workspace/ActivityTab';

type Tab = 'dashboard' | 'recipes' | 'shell' | 'activity';

export function WorkspacePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [autoRefresh] = useState(() => {
    const stored = localStorage.getItem('gws-refresh-interval');
    return stored ? parseInt(stored, 10) : 900_000;
  });

  const { data: status } = useQuery({
    queryKey: queryKeys.gwsStatus(),
    queryFn: fetchGwsStatus,
    staleTime: 60_000,
  });

  const { data: snapshot, isFetching: snapshotFetching } = useQuery({
    queryKey: queryKeys.gwsSnapshot(),
    queryFn: fetchGwsSnapshot,
    refetchInterval: autoRefresh,
    staleTime: 60_000,
  });

  const { data: recipes } = useQuery({
    queryKey: queryKeys.gwsRecipes(),
    queryFn: fetchGwsRecipes,
    staleTime: 300_000,
  });

  const { data: audit } = useQuery({
    queryKey: queryKeys.gwsAudit(),
    queryFn: () => fetchGwsAudit(20),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const refreshMutation = useMutation({
    mutationFn: refreshGwsSnapshot,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.gwsSnapshot() }),
  });

  const unavailable = status && !status.binary_found;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'recipes', label: 'Recipes', icon: Play },
    { id: 'shell', label: 'Shell', icon: Terminal },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutGrid size={18} style={{ color: 'var(--accent)' }} />
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Google Workspace</h1>
            {snapshot?.refreshed_at && tab === 'dashboard' && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Updated {relativeTime(snapshot.refreshed_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: status.binary_found ? 'var(--success-dim)' : 'rgba(239,68,68,0.15)',
                  color: status.binary_found ? 'var(--success)' : '#f87171',
                }}
              >
                {status.binary_found ? 'gws ready' : 'gws not found'}
              </span>
            )}
            {tab === 'dashboard' && (
              <button
                className={cn('btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5', (refreshMutation.isPending || snapshotFetching) && 'opacity-50')}
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending || snapshotFetching || unavailable}
              >
                <RefreshCw size={12} className={cn((refreshMutation.isPending || snapshotFetching) && 'animate-spin')} />
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors',
                tab === id ? 'font-semibold' : 'opacity-60 hover:opacity-100',
              )}
              style={
                tab === id
                  ? { background: 'var(--accent-dim, rgba(99,102,241,0.15))', color: 'var(--accent)' }
                  : { color: 'var(--text-secondary)' }
              }
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && (
        <DashboardTab
          status={status}
          snapshot={snapshot as Record<string, unknown> | undefined}
          recipes={recipes}
          audit={audit}
        />
      )}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'shell' && <ShellTab />}
      {tab === 'activity' && <ActivityTab />}
    </div>
  );
}
