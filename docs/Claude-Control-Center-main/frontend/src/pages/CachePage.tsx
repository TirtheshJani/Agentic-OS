import 'chart.js/auto';
import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { ShieldCheck, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useCacheStats } from '../hooks/useCache';
import { cn, formatTokens } from '../lib/utils';
import type { DaysRange, CacheProjectRow, CacheWindowStatus, ClaudeMdRow } from '../api/cache';

// ── Chart constants (plain hex — required by Chart.js canvas renderer) ──────
const ACCENT      = '#0ecbbe';
const TICK_COLOR  = '#8b949e';
const GRID_COLOR  = 'rgba(255,255,255,0.05)';
const TOOLTIP_BG  = 'rgba(13,17,23,0.95)';

const WARM_COLOR     = '#3ec85e';
const EXPIRING_COLOR = '#d29522';
const EXPIRED_COLOR  = '#f87171';

const DAYS_OPTIONS: DaysRange[] = [7, 30, 90, 'all'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function hitRateColor(rate: number): string {
  if (rate >= 60) return WARM_COLOR;
  if (rate >= 30) return EXPIRING_COLOR;
  return EXPIRED_COLOR;
}

function windowColor(status: CacheWindowStatus): string {
  if (status === 'warm') return WARM_COLOR;
  if (status === 'expiring') return EXPIRING_COLOR;
  if (status === 'expired') return EXPIRED_COLOR;
  return TICK_COLOR;
}

function windowLabel(status: CacheWindowStatus): string {
  if (status === 'warm') return 'Warm';
  if (status === 'expiring') return 'Expiring';
  if (status === 'expired') return 'Expired';
  return '—';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string | number | null;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </span>
      <span
        className="text-2xl font-semibold"
        style={{ color: valueColor ?? 'var(--text-primary)' }}
      >
        {value ?? '—'}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function CacheWindowBadge({
  status,
  minutesSince,
}: {
  status: CacheWindowStatus;
  minutesSince: number | null;
}) {
  const color = windowColor(status);
  const label = windowLabel(status);
  const isWarm = status === 'warm';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: `${color}1a`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {isWarm && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: color }}
        />
      )}
      {label}
      {minutesSince !== null && status !== 'unknown' && (
        <span style={{ opacity: 0.75 }}>{Math.round(minutesSince)}m ago</span>
      )}
    </span>
  );
}

function ProjectCacheTable({ rows }: { rows: CacheProjectRow[] }) {
  const [sortBy, setSortBy] = useState<'hit_rate' | 'savings_usd' | 'session_count'>('hit_rate');

  const sorted = [...rows].sort((a, b) => b[sortBy] - a[sortBy]);

  const SortBtn = ({
    col,
    label,
  }: {
    col: typeof sortBy;
    label: string;
  }) => (
    <button
      onClick={() => setSortBy(col)}
      className={cn('text-xs px-2 py-0.5 rounded transition-colors', sortBy === col ? 'font-semibold' : '')}
      style={{
        color: sortBy === col ? 'var(--accent)' : 'var(--text-secondary)',
        background: sortBy === col ? 'oklch(71% 0.185 192 / 0.10)' : 'transparent',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Cache hit rate by project
        </h3>
        <div className="flex items-center gap-1">
          <SortBtn col="hit_rate" label="Hit %" />
          <SortBtn col="savings_usd" label="Savings" />
          <SortBtn col="session_count" label="Sessions" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Project', 'Hit rate', 'Cache reads', 'Saved (USD)', 'Sessions', 'Cache window'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left font-medium"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.project}
                style={{ borderBottom: '1px solid var(--border)' }}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2 font-mono max-w-[200px] truncate" style={{ color: 'var(--text-primary)' }}>
                  {row.project}
                </td>
                <td className="px-4 py-2 font-semibold" style={{ color: hitRateColor(row.hit_rate) }}>
                  {row.hit_rate.toFixed(1)}%
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                  {formatTokens(row.cache_read_tokens)}
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                  ${row.savings_usd.toFixed(3)}
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                  {row.session_count}
                </td>
                <td className="px-4 py-2">
                  <CacheWindowBadge
                    status={row.cache_window_status}
                    minutesSince={row.minutes_since_last_session}
                  />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  No session data for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClaudeMdSection({ rows }: { rows: ClaudeMdRow[] }) {
  const sorted = [...rows].sort((a, b) => b.avg_creation_per_session - a.avg_creation_per_session);
  if (sorted.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          CLAUDE.md cache signals
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          High creation/session suggests CLAUDE.md is written to cache on first turn. High read/session confirms it's reused within sessions.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Project', 'Creation / session', 'Read / session', 'Hit rate', 'Signal'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.project}
                style={{ borderBottom: '1px solid var(--border)' }}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2 font-mono max-w-[200px] truncate" style={{ color: 'var(--text-primary)' }}>
                  {row.project}
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                  {formatTokens(row.avg_creation_per_session)}
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                  {formatTokens(row.avg_read_per_session)}
                </td>
                <td className="px-4 py-2 font-semibold" style={{ color: hitRateColor(row.hit_rate) }}>
                  {row.hit_rate.toFixed(1)}%
                </td>
                <td className="px-4 py-2">
                  {row.effective ? (
                    <span className="inline-flex items-center gap-1" style={{ color: WARM_COLOR }}>
                      <CheckCircle2 size={12} /> Effective
                    </span>
                  ) : row.avg_creation_per_session > 5000 ? (
                    <span className="inline-flex items-center gap-1" style={{ color: EXPIRING_COLOR }}>
                      <AlertCircle size={12} /> Low reuse
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1" style={{ color: TICK_COLOR }}>
                      <XCircle size={12} /> Low creation
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border)' }}>
        High creation but low reuse → CLAUDE.md may be too long, or sessions are too short to amortize creation cost.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CachePage() {
  const [days, setDays] = useState<DaysRange>(30);
  const { data, isLoading, isError } = useCacheStats(days);

  const chartData = {
    labels: data?.hit_rate_by_day.map((d) => d.date) ?? [],
    datasets: [
      {
        label: 'Cache hit rate (%)',
        data: data?.hit_rate_by_day.map((d) => d.hit_rate) ?? [],
        borderColor: ACCENT,
        backgroundColor: `${ACCENT}22`,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: ACCENT,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: TICK_COLOR, font: { size: 11 } } },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        titleColor: '#e6edf3',
        bodyColor: TICK_COLOR,
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            ctx.parsed.y != null ? ` ${ctx.parsed.y.toFixed(1)}%` : '',
        },
      },
    },
    scales: {
      x: {
        ticks: { color: TICK_COLOR, font: { size: 10 } },
        grid: { color: GRID_COLOR },
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: TICK_COLOR, font: { size: 10 }, callback: (v: number | string) => `${v}%` },
        grid: { color: GRID_COLOR },
      },
    },
  } as const;

  const savingsCAD = data ? (data.total_savings_usd * 1.38).toFixed(2) : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} color={ACCENT} />
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Cache Health
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'text-xs px-3 py-1 rounded transition-colors',
                days === d ? 'font-semibold' : ''
              )}
              style={{
                color: days === d ? 'var(--accent)' : 'var(--text-secondary)',
                background: days === d ? 'oklch(71% 0.185 192 / 0.12)' : 'transparent',
                border: `1px solid ${days === d ? 'oklch(71% 0.185 192 / 0.3)' : 'transparent'}`,
              }}
            >
              {d === 'all' ? 'All time' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6 px-6 py-6">
        {isError && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ background: 'rgba(248,113,113,0.1)', color: EXPIRED_COLOR, border: '1px solid rgba(248,113,113,0.25)' }}
          >
            Failed to load cache stats. Make sure the backend is running and has scanned your sessions.
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Global hit rate"
            value={isLoading ? '…' : data ? `${data.global_hit_rate.toFixed(1)}%` : null}
            sub="cache reads / total input"
            valueColor={data ? hitRateColor(data.global_hit_rate) : undefined}
          />
          <StatCard
            label="Cache reads"
            value={isLoading ? '…' : data ? formatTokens(data.total_cache_read_tokens) : null}
            sub="tokens served from cache"
          />
          <StatCard
            label="Cache savings"
            value={isLoading ? '…' : savingsCAD ? `$${savingsCAD}` : null}
            sub="CAD saved vs fresh tokens"
          />
          <StatCard
            label="Sessions"
            value={isLoading ? '…' : data?.session_count ?? null}
            sub={`last ${days === 'all' ? 'all time' : `${days} days`}`}
          />
        </div>

        {/* Hit rate over time */}
        {data && data.hit_rate_by_day.length > 0 && (
          <div className="card px-4 py-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Cache hit rate over time
            </h3>
            <div style={{ height: 200 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Per-project table */}
        {data && <ProjectCacheTable rows={data.by_project} />}

        {/* CLAUDE.md effectiveness */}
        {data && <ClaudeMdSection rows={data.claudemd_effectiveness} />}
      </div>
    </div>
  );
}
