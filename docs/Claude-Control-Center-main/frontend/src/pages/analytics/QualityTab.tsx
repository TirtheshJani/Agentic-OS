import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsStats } from '../../api/analytics';
import type { AnalyticsQuality, QualityByProject, DaysRange } from '../../api/analytics';
import { queryKeys } from '../../lib/queryKeys';
import { QUALITY_HIGH_COLOR, QUALITY_MED_COLOR, QUALITY_LOW_COLOR } from '../../lib/chartTheme';
import { StatCard } from '../../components/common/StatCard';
import { InsightCallout } from './components';
import { QualityDistributionChart, SignalAdoptionChart } from './charts';

export function qualityColor(score: number): string {
  return score >= 67 ? QUALITY_HIGH_COLOR : score >= 33 ? QUALITY_MED_COLOR : QUALITY_LOW_COLOR;
}

export function qualityTierLabel(score: number): string {
  return score >= 67 ? 'High' : score >= 33 ? 'Med' : 'Low';
}

function QualityBadge({ score }: { score: number }) {
  const color = qualityColor(score);
  return (
    <span style={{
      color,
      border: `1px solid ${color}40`,
      borderRadius: 4,
      padding: '1px 6px',
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {score} · {qualityTierLabel(score)}
    </span>
  );
}

function QualityProjectRow({ item }: { item: QualityByProject }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-secondary)' }} title={item.project}>
        {item.project}
      </span>
      <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
        {item.sessions} sess
      </span>
      <QualityBadge score={item.avg_score} />
    </div>
  );
}

const EMPTY_DISTRIBUTION: AnalyticsQuality['distribution'] = { high: 0, medium: 0, low: 0 };
const EMPTY_SIGNALS: AnalyticsQuality['signals'] = { verification_pct: 0, auto_pct: 0, plan_pct: 0 };

export function QualityTab({ days }: { days: DaysRange }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.analyticsStats(days),
    queryFn: () => fetchAnalyticsStats(days),
    staleTime: 5 * 60 * 1000,
  });

  const loading = isLoading && !stats;
  const quality = stats?.session_quality;
  const total = stats?.session_count ?? 0;

  const highPct = total > 0 && quality ? Math.round(quality.distribution.high / total * 100) : 0;

  const qualityInsights = stats?.insights.filter((i) => i.type.startsWith('quality_')) ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 flex-shrink-0">
        <StatCard
          label="Avg Quality Score"
          value={loading ? '…' : quality ? `${quality.avg_score}/100` : '—'}
          sub={quality ? qualityTierLabel(quality.avg_score) + ' tier average' : undefined}
        />
        <StatCard
          label="High-Quality Sessions"
          value={loading ? '…' : quality?.distribution.high ?? 0}
          sub={quality ? `${highPct}% of sessions` : undefined}
        />
        <StatCard
          label="Sessions Verified"
          value={loading ? '…' : quality ? `${quality.signals.verification_pct}%` : '—'}
          sub="ran tests or builds"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Quality distribution
          </div>
          {loading ? <div className="skeleton" style={{ height: 200 }} /> : (
            <QualityDistributionChart distribution={quality?.distribution ?? EMPTY_DISTRIBUTION} />
          )}
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
            Signal adoption
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            % of sessions using each quality signal
          </p>
          {loading ? <div className="skeleton" style={{ height: 160 }} /> : (
            <SignalAdoptionChart signals={quality?.signals ?? EMPTY_SIGNALS} />
          )}
        </div>
      </div>

      {/* Quality by project */}
      <div className="card px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
          Quality by project
        </div>
        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-5" />)}</div>
        ) : quality?.by_project.length ? (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {quality.by_project.map((p) => <QualityProjectRow key={p.project} item={p} />)}
          </div>
        ) : (
          <p className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No data — run a rescan first</p>
        )}
      </div>

      {/* Quality insights */}
      {qualityInsights.length > 0 && (
        <div className="flex flex-col gap-2 flex-shrink-0">
          {qualityInsights.map((ins) => <InsightCallout key={ins.type} insight={ins} />)}
        </div>
      )}

      {/* Legend */}
      <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
        Score = Verification (34 pts) + Auto mode (33 pts) + Plan mode (33 pts) · based on Boris Cherny's Opus 4.7 tips
      </p>
    </div>
  );
}
