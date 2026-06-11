import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { Database, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { fetchCodexHistory, fetchCodexSessionIndex } from '../api/codexCliMemory';
import type { CodexHistoryItem } from '../api/codexCliMemory';
import { absoluteTime } from '../lib/utils';
import { cn } from '../lib/utils';

type TabKey = 'history' | 'session-index';

function HistoryRow({ item }: { item: CodexHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div
        className="grid gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
        style={{
          gridTemplateColumns: '3fr 1fr 1fr 24px',
          borderBottom: '1px solid var(--border)',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }} title={item.text}>
          {item.text || '—'}
        </span>
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
          {item.session_id?.slice(0, 8)}…
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {item.datetime ? absoluteTime(item.datetime) : '—'}
        </span>
        <span className="flex items-center justify-center">
          {expanded
            ? <ChevronUp size={13} style={{ color: 'var(--text-tertiary)' }} />
            : <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} />}
        </span>
      </div>
      {expanded && (
        <div
          className="px-4 py-3 space-y-2"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
            Full prompt
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
          <div className="text-xs font-mono mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Session: {item.session_id}
          </div>
        </div>
      )}
    </>
  );
}

function HistoryTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [search]);

  const PAGE_SIZE = 50;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codexCliHistory(page, debouncedSearch),
    queryFn: () => fetchCodexHistory(page, PAGE_SIZE, debouncedSearch),
    staleTime: 60_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Search */}
      <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Search size={12} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search history…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {data && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {data.total} entries
            </span>
          )}
        </div>
      </div>

      {/* Table header */}
      <div
        className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0"
        style={{
          gridTemplateColumns: '3fr 1fr 1fr 24px',
          color: 'var(--text-tertiary)',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Prompt</span>
        <span>Session</span>
        <span>Date</span>
        <span />
      </div>

      {isLoading && (
        <div className="flex-1 space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-28" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="flex-1 overflow-auto">
          {(!data || data.items.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <Database size={32} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {debouncedSearch ? 'No matching entries.' : 'No query history found.'}
              </p>
            </div>
          ) : (
            data.items.map((item, i) => <HistoryRow key={`${item.session_id}-${i}`} item={item} />)
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all"
            >
              <ChevronLeft size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all"
            >
              <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionIndexTab() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codexCliSessionIndex(page),
    queryFn: () => fetchCodexSessionIndex(page, PAGE_SIZE),
    staleTime: 60_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
      <div
        className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0"
        style={{
          gridTemplateColumns: '2fr 1fr 1fr',
          color: 'var(--text-tertiary)',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Thread Name</span>
        <span>Session ID</span>
        <span>Last Updated</span>
      </div>

      {isLoading && (
        <div className="flex-1 space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-28" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="flex-1 overflow-auto">
          {(!data || data.items.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <Database size={32} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No session index entries found.</p>
            </div>
          ) : (
            data.items.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 px-4 py-3"
                style={{
                  gridTemplateColumns: '2fr 1fr 1fr',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }} title={item.thread_name}>
                  {item.thread_name || '—'}
                </span>
                <span className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
                  {item.id?.slice(0, 12)}…
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {item.updated_at ? absoluteTime(item.updated_at) : '—'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all"
            >
              <ChevronLeft size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all"
            >
              <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CodexCliMemoryPage() {
  const [tab, setTab] = useState<TabKey>('history');

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <Database size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Codex Memory</h1>
      </div>

      <div className="flex gap-1 p-0.5 rounded-md w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        {(['history', 'session-index'] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 text-xs rounded transition-all')}
            style={{
              background: tab === t ? 'rgba(255,255,255,0.08)' : undefined,
              color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: tab === t ? 500 : undefined,
            }}
          >
            {t === 'history' ? 'Query History' : 'Session Index'}
          </button>
        ))}
      </div>

      {tab === 'history' ? <HistoryTab /> : <SessionIndexTab />}
    </div>
  );
}
