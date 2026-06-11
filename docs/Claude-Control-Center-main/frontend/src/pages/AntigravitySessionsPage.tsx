import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sparkles, RefreshCw, Clock, Wrench, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAntigravitySessions, triggerAntigravityScan } from '../api/antigravity';
import { useAntigravitySessions } from '../hooks/useAntigravity';
import { absoluteTime } from '../lib/utils';
import { cn } from '../lib/utils';

function durationLabel(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
}

export function AntigravitySessionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data, isLoading, refetch, isFetching } = useAntigravitySessions({
    page,
    limit: 20,
    search: search || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <Sparkles size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Antigravity Sessions</h1>
        {data && (
          <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            {data.total} session{data.total !== 1 ? 's' : ''}
          </span>
        )}
        <button
          className={cn('ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/10', isFetching && 'opacity-60 pointer-events-none')}
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          onClick={() => triggerAntigravityScan().then(() => refetch())}
          disabled={isFetching}
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Scanning…' : 'Rescan'}
        </button>
      </div>

      <div className="card px-3 py-3">
        <input
          type="text"
          placeholder="Search task, project, or session ID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full px-3 py-1.5 text-xs rounded-md bg-transparent"
          style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>

      <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0" style={{ gridTemplateColumns: 'minmax(0,2fr) 1fr 1fr 80px 80px 100px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          <span>Task</span><span>Project</span><span>ID</span><span>Duration</span><span>Tools</span><span />
        </div>

        {isLoading && (
          <div className="flex-1 space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton h-4 w-6" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="flex-1 overflow-auto">
            {(!data || data.items.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No sessions found.</p>
              </div>
            ) : (
              data.items.map((s) => (
                <div
                  key={s.session_id}
                  className="grid gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  style={{ gridTemplateColumns: 'minmax(0,2fr) 1fr 1fr 80px 80px 100px', borderBottom: '1px solid var(--border)' }}
                  onClick={() => navigate(`/antigravity-sessions/${s.session_id}`)}
                >
                  <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }} title={s.task_text}>{s.task_text || '—'}</span>
                  <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{s.project || '—'}</span>
                  <span className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{s.session_id || '—'}</span>
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                    {s.duration_seconds != null ? <><Clock size={11} />{durationLabel(s.duration_seconds)}</> : '—'}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                    <Wrench size={11} />{s.total_tool_calls}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>View details</span>
                </div>
              ))
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all">
                <ChevronLeft size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all">
                <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
