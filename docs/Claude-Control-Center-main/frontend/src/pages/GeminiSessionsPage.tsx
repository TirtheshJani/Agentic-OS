import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  GitBranch, Clock, Wrench, Star, Archive, ArchiveRestore, FileText, Save, Eraser, Filter, Radio,
} from 'lucide-react';
import {
  fetchGeminiSessions, fetchGeminiSessionStats, triggerGeminiScan,
} from '../api/gemini';
import type { GeminiSessionSort, GeminiSessionSummary } from '../api/gemini';
import { absoluteTime, relativeTime } from '../lib/utils';
import { cn } from '../lib/utils';
import { useGeminiSSE } from '../hooks/useGeminiSSE';
import { queryKeys } from '../lib/queryKeys';

function StatCard({ label, value, sub }: { label: string; value: string | number | null; sub?: string }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  );
}

function DateChart({ data }: { data: { date: string; sessions: number }[] }) {
  if (!data.length) return null;
  const recent = data.slice(-20);
  const max = Math.max(...recent.map((d) => d.sessions), 1);
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        Sessions per day
      </div>
      <div className="flex items-end gap-0.5" style={{ height: 56 }}>
        {recent.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-sm"
            style={{ height: Math.max(3, Math.round((d.sessions / max) * 48)), background: 'var(--accent)', opacity: 0.75 }}
            title={`${d.date}: ${d.sessions}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{recent[0]?.date}</span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{recent[recent.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function durationLabel(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
}

type SessionMetaPatch = Partial<Pick<GeminiSessionSummary, 'starred' | 'archived' | 'note'>>;

function SessionRow({
  session,
  onMetaPatch,
  isMetaSaving,
}: {
  session: GeminiSessionSummary;
  onMetaPatch: (sessionId: string, patch: SessionMetaPatch) => void;
  isMetaSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteDraft, setNoteDraft] = useState(session.note ?? '');
  const navigate = useNavigate();
  const topTools = Object.entries(session.tool_calls).sort(([, a], [, b]) => b - a).slice(0, 5);
  const isLive = session.last_ts
    ? (Date.now() - new Date(session.last_ts).getTime()) < 2 * 60 * 1000
    : false;

  useEffect(() => {
    setNoteDraft(session.note ?? '');
  }, [session.note, session.session_id]);

  const noteDirty = noteDraft.trim() !== (session.note ?? '');

  return (
    <>
      <div
        className={cn('grid gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer', session.archived && 'opacity-70')}
        style={{ gridTemplateColumns: '28px minmax(0,2fr) 1fr 1fr 80px 80px 24px', borderBottom: '1px solid var(--border)' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <button
          className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-60"
          style={{ color: session.starred ? '#fbbf24' : 'var(--text-tertiary)' }}
          onClick={(e) => { e.stopPropagation(); onMetaPatch(session.session_id, { starred: !session.starred }); }}
          disabled={isMetaSaving}
        >
          <Star size={14} fill={session.starred ? 'currentColor' : 'none'} />
        </button>

        <div className="min-w-0 flex items-center gap-2">
          <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }} title={session.task_text}>
            {session.task_text || '—'}
          </span>
          {!!session.note && <span title="Has note"><FileText size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} /></span>}
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
              <Radio size={9} />Live
            </span>
          )}
          {session.archived && (
            <span className="chip text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
              Archived
            </span>
          )}
        </div>

        <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{session.project || '—'}</span>
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{session.model || '—'}</span>
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
          {session.duration_seconds != null ? <><Clock size={11} />{durationLabel(session.duration_seconds)}</> : '—'}
        </span>
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
          <Wrench size={11} />{session.total_tool_calls}
        </span>
        <span className="flex items-center justify-center">
          {expanded ? <ChevronUp size={13} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} />}
        </span>
      </div>

      {expanded && (
        <div className="px-4 py-3 space-y-3" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {session.first_ts && (
              <div>
                <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Started</span>
                <div className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>{absoluteTime(session.first_ts)}</div>
              </div>
            )}
            {session.cwd && (
              <div>
                <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Path</span>
                <div className="font-mono mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{session.cwd}</div>
              </div>
            )}
            {session.git_branch && (
              <div>
                <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Branch</span>
                <div className="font-mono mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <GitBranch size={11} />{session.git_branch}
                </div>
              </div>
            )}
            {session.updated_at && (
              <div>
                <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Meta updated</span>
                <div className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>{relativeTime(session.updated_at)}</div>
              </div>
            )}
          </div>

          {session.task_text && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Task</div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{session.task_text}</p>
            </div>
          )}

          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Session note</div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Add context or notes for this session…"
              className="w-full px-3 py-2 text-xs rounded-md bg-transparent resize-y"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs hover:bg-white/10 transition-all disabled:opacity-40"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                onClick={() => onMetaPatch(session.session_id, { note: noteDraft.trim() })}
                disabled={!noteDirty || isMetaSaving}
              >
                <Save size={11} /> Save note
              </button>
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs hover:bg-white/10 transition-all disabled:opacity-40"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                onClick={() => onMetaPatch(session.session_id, { note: '' })}
                disabled={(session.note ?? '') === '' || isMetaSaving}
              >
                <Eraser size={11} /> Clear
              </button>
            </div>
          </div>

          {topTools.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Tool calls</div>
              <div className="flex flex-wrap gap-2">
                {topTools.map(([name, count]) => (
                  <span key={name} className="chip text-xs font-mono" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    {name} × {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs hover:bg-white/10 transition-all disabled:opacity-40"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              onClick={() => onMetaPatch(session.session_id, { archived: !session.archived })}
              disabled={isMetaSaving}
            >
              {session.archived ? <ArchiveRestore size={11} /> : <Archive size={11} />}
              {session.archived ? 'Restore' : 'Archive'}
            </button>
            <button
              className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent)' }}
              onClick={() => navigate(`/gemini-sessions/${session.session_id}`)}
            >
              <Sparkles size={11} /> View full session
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const PAGE_SIZE = 20;
const SORT_OPTIONS: { value: GeminiSessionSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'duration', label: 'Longest' },
  { value: 'tools', label: 'Most tools' },
  { value: 'turns', label: 'Most turns' },
];

export function GeminiSessionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [sort, setSort] = useState<GeminiSessionSort>('newest');
  const [starredOnly, setStarredOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [minTools, setMinTools] = useState(0);
  const [pendingMetaSessionId, setPendingMetaSessionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useGeminiSSE();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.geminiSessionStats(),
    queryFn: () => fetchGeminiSessionStats(30),
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.geminiSessions(page, search, projectFilter, modelFilter, sort, starredOnly, includeArchived, minTools),
    queryFn: () => fetchGeminiSessions({
      page, limit: PAGE_SIZE,
      project: projectFilter !== 'all' ? projectFilter : undefined,
      model: modelFilter !== 'all' ? modelFilter : undefined,
      search: search || undefined,
      sort,
      starred: starredOnly ? true : undefined,
      includeArchived,
      minTools: minTools > 0 ? minTools : undefined,
    }),
    staleTime: 60_000,
  });

  const { mutate: rescan, isPending: scanning } = useMutation({
    mutationFn: triggerGeminiScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.geminiSessionStats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.geminiSessions() });
    },
  });

  const { mutate: patchSessionMeta, isPending: isMetaSaving } = useMutation({
    mutationFn: ({ sessionId, patch }: { sessionId: string; patch: SessionMetaPatch }) =>
      Promise.resolve({ sessionId, patch }),
    onMutate: ({ sessionId }) => setPendingMetaSessionId(sessionId),
    onSettled: () => {
      setPendingMetaSessionId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.geminiSessions() });
    },
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const overview = stats?.overview;
  const avgDurStr = overview?.avg_duration_seconds != null ? durationLabel(overview.avg_duration_seconds) : null;
  const projectOptions = useMemo(() => (stats?.projects ?? []).map((p) => p.project), [stats?.projects]);
  const modelOptions = useMemo(() => (stats?.models ?? []).map((m) => m.model), [stats?.models]);

  const hasFilters = search !== '' || projectFilter !== 'all' || modelFilter !== 'all' || sort !== 'newest' || starredOnly || includeArchived || minTools > 0;

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <Sparkles size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Gemini Sessions</h1>
        {data && (
          <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            {data.total} session{data.total !== 1 ? 's' : ''}
          </span>
        )}
        <button
          className={cn('ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/10', scanning && 'opacity-60 pointer-events-none')}
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          onClick={() => rescan()}
          disabled={scanning}
        >
          <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Scanning…' : 'Rescan'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total sessions" value={statsLoading ? '…' : (overview?.total_sessions ?? 0)} />
        <StatCard label="Active days" value={statsLoading ? '…' : (overview?.active_days ?? 0)} />
        <StatCard label="Total tool calls" value={statsLoading ? '…' : (overview?.total_tool_calls ?? 0)} />
        <StatCard label="Avg duration" value={statsLoading ? '…' : avgDurStr} />
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {stats.activity.by_date.length > 0 && <DateChart data={stats.activity.by_date} />}
          {(stats.projects?.length ?? 0) > 0 && (
            <div className="card px-4 py-3">
              <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>By project</div>
              <div className="space-y-2">
                {(stats.projects ?? []).slice(0, 6).map((p) => (
                  <div key={p.project} className="flex items-center gap-2">
                    <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{p.project}</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{p.sessions}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card px-3 py-3 space-y-2">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_160px_160px_130px_120px_auto]">
          <input
            type="text"
            placeholder="Search task, project, session ID, or note…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-xs rounded-md bg-transparent"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          />
          <select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }} className="px-2 py-1.5 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <option value="all">All projects</option>
            {projectOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={modelFilter} onChange={(e) => { setModelFilter(e.target.value); setPage(1); }} className="px-2 py-1.5 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <option value="all">All models</option>
            {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value as GeminiSessionSort); setPage(1); }} className="px-2 py-1.5 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type="number" min={0} max={200} value={minTools} onChange={(e) => { setMinTools(Math.max(0, Number(e.target.value) || 0)); setPage(1); }} className="px-3 py-1.5 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }} placeholder="Min tools" />
          <button className="px-3 py-1.5 rounded-md text-xs hover:bg-white/10 transition-all disabled:opacity-40" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }} onClick={() => { setSearch(''); setProjectFilter('all'); setModelFilter('all'); setSort('newest'); setStarredOnly(false); setIncludeArchived(false); setMinTools(0); setPage(1); }} disabled={!hasFilters}>
            Clear filters
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}><Filter size={11} /> View</span>
          <button className="flex items-center gap-1 px-2.5 py-1 rounded text-xs hover:bg-white/10 transition-all" style={{ border: '1px solid var(--border)', color: starredOnly ? '#fbbf24' : 'var(--text-secondary)', background: starredOnly ? 'rgba(251,191,36,0.08)' : undefined }} onClick={() => { setStarredOnly((v) => !v); setPage(1); }}>
            <Star size={11} fill={starredOnly ? 'currentColor' : 'none'} /> Starred only
          </button>
          <button className="flex items-center gap-1 px-2.5 py-1 rounded text-xs hover:bg-white/10 transition-all" style={{ border: '1px solid var(--border)', color: includeArchived ? 'var(--text-primary)' : 'var(--text-secondary)', background: includeArchived ? 'rgba(255,255,255,0.06)' : undefined }} onClick={() => { setIncludeArchived((v) => !v); setPage(1); }}>
            {includeArchived ? <ArchiveRestore size={11} /> : <Archive size={11} />}
            {includeArchived ? 'Including archived' : 'Hide archived'}
          </button>
        </div>
      </div>

      <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0" style={{ gridTemplateColumns: '28px minmax(0,2fr) 1fr 1fr 80px 80px 24px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          <span /><span>Task</span><span>Project</span><span>Model</span><span>Duration</span><span>Tools</span><span />
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
                <div className="skeleton h-4 w-12" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="flex-1 overflow-auto">
            {(!data || data.items.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                <Sparkles size={32} style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {hasFilters ? 'No sessions match the current filters.' : 'No Gemini sessions found.'}
                </p>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white/10 transition-all" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }} onClick={() => rescan()}>
                  <RefreshCw size={12} /> Run scan
                </button>
              </div>
            ) : (
              data.items.map((s) => (
                <SessionRow
                  key={s.session_id || s.filepath}
                  session={s}
                  onMetaPatch={(sessionId, patch) => patchSessionMeta({ sessionId, patch })}
                  isMetaSaving={isMetaSaving && pendingMetaSessionId === s.session_id}
                />
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
