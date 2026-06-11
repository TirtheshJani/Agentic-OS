import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { BarChart2, RefreshCw } from 'lucide-react';
import { fetchGeminiSessionStats, triggerGeminiScan } from '../api/gemini';
import { cn } from '../lib/utils';

type DaysOption = 7 | 30 | 90 | 'all';

function StatCard({ label, value, sub }: { label: string; value: string | number | null; sub?: string }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  );
}

function HorizontalBar({ name, count, max }: { name: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono w-36 truncate flex-shrink-0" style={{ color: 'var(--text-secondary)' }} title={name}>{name}</span>
      <div className="flex-1 rounded-sm overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: 'var(--accent)', opacity: 0.8 }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right" style={{ color: 'var(--text-tertiary)' }}>{count}</span>
    </div>
  );
}

function DateChart({ data }: { data: { date: string; sessions: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.sessions), 1);
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Sessions over time</div>
      <div className="flex items-end gap-0.5" style={{ height: 60 }}>
        {data.slice(-30).map((d) => (
          <div key={d.date} className="flex-1 rounded-sm" style={{ height: Math.max(3, Math.round((d.sessions / max) * 52)), background: 'var(--accent)', opacity: 0.75 }} title={`${d.date}: ${d.sessions}`} />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{data[Math.max(0, data.length - 30)]?.date}</span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function HourChart({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Activity by hour (UTC)</div>
      <div className="flex items-end gap-px" style={{ height: 40 }}>
        {data.map((d) => (
          <div key={d.hour} className="flex-1 rounded-sm" style={{ height: Math.max(2, Math.round((d.count / max) * 36)), background: 'var(--accent)', opacity: 0.6 }} title={`${d.hour}:00 — ${d.count} sessions`} />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>0h</span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>23h</span>
      </div>
    </div>
  );
}

const DAYS_OPTIONS: { label: string; value: DaysOption }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 'all' },
];

export function GeminiAnalyticsPage() {
  const [days, setDays] = useState<DaysOption>(30);
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.geminiAnalytics(days),
    queryFn: () => fetchGeminiSessionStats(days),
    staleTime: 60_000,
  });

  const { mutate: rescan, isPending: scanning } = useMutation({
    mutationFn: triggerGeminiScan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.geminiAnalytics() }),
  });

  const overview = stats?.overview;
  const avgDur = overview?.avg_duration_seconds;
  const avgDurStr = avgDur != null ? (avgDur < 60 ? `${Math.round(avgDur)}s` : `${Math.round(avgDur / 60)}m`) : null;
  const maxToolCount = Math.max(...(stats?.tools.top_tools.map((t) => t.count) ?? []), 1);
  const maxModelCount = Math.max(...(stats?.models.map((m) => m.sessions) ?? []), 1);
  const maxProjectSessions = Math.max(...(stats?.projects.map((p) => p.sessions) ?? []), 1);

  return (
    <div className="p-6 flex flex-col h-full gap-5 overflow-auto">
      <div className="flex items-center gap-3">
        <BarChart2 size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Gemini Analytics</h1>

        <div className="flex gap-0.5 p-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
          {DAYS_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setDays(opt.value)} className={cn('px-2.5 py-1 text-xs rounded transition-all')} style={{ background: days === opt.value ? 'rgba(255,255,255,0.08)' : undefined, color: days === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: days === opt.value ? 500 : undefined }}>
              {opt.label}
            </button>
          ))}
        </div>

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
        <StatCard label="Total sessions" value={isLoading ? '…' : (overview?.total_sessions ?? 0)} />
        <StatCard label="Active days" value={isLoading ? '…' : (overview?.active_days ?? 0)} />
        <StatCard label="Total tool calls" value={isLoading ? '…' : (overview?.total_tool_calls ?? 0)} />
        <StatCard label="Avg duration" value={isLoading ? '…' : avgDurStr} />
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {stats.activity.by_date.length > 0 && <DateChart data={stats.activity.by_date} />}
          {stats.activity.by_hour.length > 0 && <HourChart data={stats.activity.by_hour} />}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {stats.tools.top_tools.length > 0 && (
            <div className="card px-4 py-3">
              <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Top tools</div>
              <div className="space-y-2">
                {stats.tools.top_tools.map((t) => <HorizontalBar key={t.name} name={t.name} count={t.count} max={maxToolCount} />)}
              </div>
            </div>
          )}
          {stats.models.length > 0 && (
            <div className="card px-4 py-3">
              <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Model usage</div>
              <div className="space-y-2">
                {stats.models.map((m) => <HorizontalBar key={m.model} name={m.model} count={m.sessions} max={maxModelCount} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {stats && stats.projects.length > 0 && (
        <div className="card px-4 py-3">
          <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Projects</div>
          <div className="space-y-2">
            {stats.projects.map((p) => (
              <div key={p.project} className="flex items-center gap-3">
                <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{p.project}</span>
                <div className="w-32 rounded-sm overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-sm" style={{ width: `${(p.sessions / maxProjectSessions) * 100}%`, background: 'var(--accent)', opacity: 0.7 }} />
                </div>
                <span className="text-xs tabular-nums w-16 text-right" style={{ color: 'var(--text-tertiary)' }}>{p.sessions} sess · {p.total_tool_calls} tools</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && stats?.session_count === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <BarChart2 size={32} style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No sessions in this time range.</p>
        </div>
      )}
    </div>
  );
}
