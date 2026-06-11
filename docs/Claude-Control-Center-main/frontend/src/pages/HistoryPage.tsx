import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { History, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { fetchHistory } from '../api/history';
import { absoluteTime, shortPath } from '../lib/utils';

const PAGE_SIZE = 100;

export function HistoryPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.history(offset),
    queryFn: () => fetchHistory(PAGE_SIZE, offset),
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const filtered = search
    ? items.filter(
        (i) =>
          i.display?.toLowerCase().includes(search.toLowerCase()) ||
          i.project?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 15,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-5">
        <History size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          History
        </h1>
        {data && (
          <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            {data.total.toLocaleString()} entries
          </span>
        )}
      </div>

      {/* Search + pagination */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-tertiary)' }} />
          <input
            className="input-field pl-8 w-full"
            placeholder="Filter history…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all"
          >
            <ChevronLeft size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {currentPage} / {totalPages || 1}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={!data || offset + PAGE_SIZE >= data.total}
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all"
          >
            <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="grid grid-cols-[3fr_2fr_1fr] gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0"
          style={{ color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          <span>Command</span>
          <span>Project</span>
          <span>Time</span>
        </div>

        {isLoading && (
          <div className="flex-1 space-y-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-24" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div ref={parentRef} className="flex-1 overflow-auto">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const item = filtered[vi.index];
                return (
                  <div
                    key={vi.index}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    className="grid grid-cols-[3fr_2fr_1fr] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${vi.start}px)`,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.display || '—'}
                    </span>
                    <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                      {shortPath(item.project)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {absoluteTime(item.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
