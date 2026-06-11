import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { Repeat, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { fetchRoutineUsages, fetchRoutineStats, triggerRoutineScan } from '../api/routines';
import type { RoutineUsage } from '../api/routines';
import { absoluteTime, shortPath } from '../lib/utils';
import { cn } from '../lib/utils';

function StatCard({ label, value, sub }: { label: string; value: string | number | null; sub?: string }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value ?? '—'}
      </span>
      {sub && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  );
}

function WeekChart({ data }: { data: { week: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const recent = data.slice(-12);
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        Invocations per week
      </div>
      <div className="flex items-end gap-1" style={{ height: 60 }}>
        {recent.map((d) => (
          <div key={d.week} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${d.week}: ${d.count}`}>
            <div
              className="w-full rounded-sm"
              style={{
                height: Math.max(4, Math.round((d.count / max) * 52)),
                background: 'var(--accent)',
                opacity: 0.75,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{recent[0]?.week}</span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{recent[recent.length - 1]?.week}</span>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: RoutineUsage['status'] }) {
  if (status === 'success') return <CheckCircle size={13} style={{ color: 'var(--success)' }} />;
  if (status === 'error') return <XCircle size={13} style={{ color: '#f85149' }} />;
  return <HelpCircle size={13} style={{ color: 'var(--text-tertiary)' }} />;
}

function SkillBadge({ name }: { name: string }) {
  // Shorten namespaced skill names like "frontend-design:frontend-design" → "frontend-design"
  const label = name.includes(':') ? name.split(':')[0] : name;
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium"
      style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid oklch(71% 0.185 192 / 0.25)' }}
    >
      /{label}
    </span>
  );
}

function UsageRow({ usage }: { usage: RoutineUsage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        className="grid gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
        style={{
          gridTemplateColumns: '1.6fr 1fr 1.3fr 80px 80px 24px',
          borderBottom: '1px solid var(--border)',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <SkillBadge name={usage.skill} />
          {usage.args && (
            <span className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }} title={usage.args}>
              {usage.args}
            </span>
          )}
        </div>
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
          {usage.project}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {usage.started_at ? absoluteTime(usage.started_at) : '—'}
        </span>
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
          {usage.duration_seconds != null ? (
            <><Clock size={11} />{usage.duration_seconds}s</>
          ) : '—'}
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <StatusIcon status={usage.status} />
          {usage.status}
        </span>
        <span className="flex items-center justify-center">
          {expanded
            ? <ChevronUp size={13} style={{ color: 'var(--text-tertiary)' }} />
            : <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} />}
        </span>
      </div>

      {expanded && (
        <div
          className="px-4 py-3 space-y-3"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Skill</span>
              <div className="font-mono mt-0.5" style={{ color: 'var(--text-secondary)' }}>{usage.skill}</div>
            </div>
            <div>
              <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Session</span>
              <div className="font-mono mt-0.5" style={{ color: 'var(--text-secondary)' }}>{usage.session_id}</div>
            </div>
            <div>
              <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Path</span>
              <div className="font-mono mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                {shortPath(usage.cwd || usage.project_path)}
              </div>
            </div>
            {usage.caller_type && (
              <div>
                <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Caller</span>
                <div className="font-mono mt-0.5" style={{ color: 'var(--text-secondary)' }}>{usage.caller_type}</div>
              </div>
            )}
            {usage.git_branch && (
              <div>
                <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Branch</span>
                <div className="font-mono mt-0.5" style={{ color: 'var(--text-secondary)' }}>{usage.git_branch}</div>
              </div>
            )}
            {usage.ended_at && (
              <div>
                <span className="font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Ended</span>
                <div className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>{absoluteTime(usage.ended_at)}</div>
              </div>
            )}
          </div>

          {usage.args && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Arguments
              </div>
              <pre
                className="text-xs font-mono whitespace-pre-wrap break-words rounded p-3 overflow-auto"
                style={{
                  maxHeight: 150,
                  background: 'rgba(0,0,0,0.3)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                {usage.args}
              </pre>
            </div>
          )}

          {usage.output && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Output
              </div>
              <pre
                className="text-xs font-mono whitespace-pre-wrap break-words rounded p-3 overflow-auto"
                style={{
                  maxHeight: 300,
                  background: 'rgba(0,0,0,0.3)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                {usage.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </>
  );
}

const PAGE_SIZE = 50;

export function RoutinesPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.routineStats(),
    queryFn: fetchRoutineStats,
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.routineUsages(page),
    queryFn: () => fetchRoutineUsages(page, PAGE_SIZE),
    staleTime: 60_000,
  });

  const { mutate: rescan, isPending: scanning } = useMutation({
    mutationFn: triggerRoutineScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routineStats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.routineUsages() });
    },
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Repeat size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Routines Tracker
        </h1>
        {data && (
          <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            {data.total} invocation{data.total !== 1 ? 's' : ''}
          </span>
        )}
        <button
          className={cn(
            'ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            'hover:bg-white/10',
            scanning && 'opacity-60 pointer-events-none'
          )}
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          onClick={() => rescan()}
          disabled={scanning}
        >
          <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Scanning…' : 'Rescan'}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total invocations" value={statsLoading ? '…' : (stats?.total ?? 0)} />
        <StatCard label="Unique skills" value={statsLoading ? '…' : (stats?.unique_skills ?? 0)} />
        <StatCard
          label="Avg duration"
          value={stats?.avg_duration_seconds != null ? `${stats.avg_duration_seconds}s` : null}
        />
        <StatCard
          label="Success rate"
          value={stats?.success_rate != null ? `${stats.success_rate}%` : null}
        />
      </div>

      {/* Charts + breakdowns */}
      {stats && (stats.by_week.length > 0 || stats.by_skill.length > 0 || stats.projects.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {stats.by_week.length > 0 && <WeekChart data={stats.by_week} />}

          {stats.by_skill.length > 0 && (
            <div className="card px-4 py-3">
              <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Top skills
              </div>
              <div className="space-y-2">
                {stats.by_skill.slice(0, 7).map((s) => {
                  const label = s.skill.includes(':') ? s.skill.split(':')[0] : s.skill;
                  const maxCount = stats.by_skill[0]?.count || 1;
                  return (
                    <div key={s.skill} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                            /{label}
                          </span>
                          <span className="text-xs font-semibold tabular-nums ml-2" style={{ color: 'var(--text-primary)' }}>
                            {s.count}
                          </span>
                        </div>
                        <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round((s.count / maxCount) * 100)}%`,
                              background: 'var(--accent)',
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.projects.length > 0 && (
            <div className="card px-4 py-3">
              <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                By project
              </div>
              <div className="space-y-2">
                {stats.projects.slice(0, 7).map((p) => (
                  <div key={p.project} className="flex items-center gap-2">
                    <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {p.project}
                    </span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {p.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Table header */}
        <div
          className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0"
          style={{
            gridTemplateColumns: '1.6fr 1fr 1.3fr 80px 80px 24px',
            color: 'var(--text-tertiary)',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>Skill / Args</span>
          <span>Project</span>
          <span>Started</span>
          <span>Duration</span>
          <span>Status</span>
          <span />
        </div>

        {isLoading && (
          <div className="flex-1 space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-28" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="flex-1 overflow-auto">
            {(!data || data.items.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                <Repeat size={32} style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No routine invocations found yet.</p>
                <button
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white/10 transition-all"
                  style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  onClick={() => rescan()}
                >
                  <RefreshCw size={12} />
                  Run scan
                </button>
              </div>
            ) : (
              data.items.map((usage) => <UsageRow key={`${usage.session_id}-${usage.tool_use_id}`} usage={usage} />)
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Page {page} of {totalPages}
            </span>
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
    </div>
  );
}
