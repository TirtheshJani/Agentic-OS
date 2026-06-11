import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { fetchGwsActivity, triggerGwsActivityScan } from '../../api/gws';
import { queryKeys } from '../../lib/queryKeys';
import { relativeTime, cn } from '../../lib/utils';
import { FilterBar, type FilterOption } from '../../components/common/FilterBar';
import { ActivityRow } from './rows';

const SOURCE_OPTIONS: FilterOption[] = ['manual', 'claude-code', 'codex', 'hook', 'recipe'].map(
  (s) => ({ value: s, label: s }),
);
const SERVICE_OPTIONS: FilterOption[] = [
  'gmail', 'drive', 'calendar', 'workflow', 'tasks', 'sheets', 'docs',
  'chat', 'people', 'forms', 'keep', 'slides', 'meet', 'script',
].map((s) => ({ value: s, label: s }));

export function ActivityTab() {
  const qc = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.gwsActivity(sourceFilter, serviceFilter, page),
    queryFn: () => fetchGwsActivity({
      limit,
      page,
      source: sourceFilter || undefined,
      service: serviceFilter || undefined,
    }),
    staleTime: 30_000,
  });

  const scanMut = useMutation({
    mutationFn: triggerGwsActivityScan,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.gwsActivity() }),
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-3 flex-shrink-0 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
        <FilterBar
          label="Source:"
          options={SOURCE_OPTIONS}
          value={sourceFilter}
          onChange={(v) => { setSourceFilter(v); setPage(1); }}
        />
        <FilterBar
          label="Service:"
          options={SERVICE_OPTIONS}
          value={serviceFilter}
          onChange={(v) => { setServiceFilter(v); setPage(1); }}
        />
        <div className="ml-auto flex items-center gap-2">
          {data?.scanned_at && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Scanned {relativeTime(data.scanned_at)}
            </span>
          )}
          <button
            className={cn('btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5', (scanMut.isPending || isFetching) && 'opacity-50')}
            onClick={() => scanMut.mutate()}
            disabled={scanMut.isPending || isFetching}
          >
            <RefreshCw size={11} className={cn((scanMut.isPending || isFetching) && 'animate-spin')} />
            Rescan
          </button>
        </div>
      </div>

      {/* Records */}
      <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1">
        {records.length === 0 ? (
          <div className="text-xs py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
            {isFetching ? 'Loading…' : 'No activity found. Run a rescan or execute some gws commands.'}
          </div>
        ) : (
          records.map((r) => <ActivityRow key={r.id} record={r} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-2 flex-shrink-0 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {total} records · page {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <button className="btn-ghost text-xs px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronUp size={12} />
            </button>
            <button className="btn-ghost text-xs px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
